import { createHash } from "crypto";
import { logAction } from "@/lib/capabilities";
import { analyzeSpendSms } from "@/lib/companion";
import { prisma } from "@/lib/db";
import { buildEntryInput, createEntry } from "@/lib/entries";
import { formatMoney } from "@/lib/format";
import { parseFields } from "@/lib/utils";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// Inbound webhook for payment SMS forwarded from your phone (Tasker / MacroDroid
// / an SMS-forwarder app). Each payment SMS is parsed, auto-categorized, logged
// as an expense, and given a grounded "worth it?" thought — no app, no speaking.
//
// Auth: set SMS_INGEST_SECRET (falls back to CRON_SECRET) and pass it as
// ?secret=… or an Authorization: Bearer header.

const SEEN_KEY = "sms:seen";

async function authed(request: Request, url: URL): Promise<boolean> {
  const secret = process.env.SMS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → open (single-user)
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

async function alreadySeen(text: string): Promise<boolean> {
  const hash = createHash("sha1").update(text.trim()).digest("hex").slice(0, 16);
  const row = await prisma.appState.findUnique({ where: { key: SEEN_KEY } });
  let seen: string[] = [];
  try {
    seen = JSON.parse(row?.value ?? "[]");
  } catch {
    seen = [];
  }
  if (seen.includes(hash)) return true;
  seen.push(hash);
  await prisma.appState.upsert({
    where: { key: SEEN_KEY },
    create: { key: SEEN_KEY, value: JSON.stringify(seen.slice(-500)) },
    update: { value: JSON.stringify(seen.slice(-500)) },
  });
  return false;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await authed(request, url))) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string; message?: string; sms?: string };
  const text = String(body.text ?? body.message ?? body.sms ?? "").trim();
  if (!text) return Response.json({ error: "No SMS text provided." }, { status: 400 });

  if (await alreadySeen(text)) return Response.json({ ok: true, skipped: "duplicate" });

  const a = await analyzeSpendSms(text);
  if (!a || !a.isTransaction || !a.debit || a.amount <= 0) {
    return Response.json({ ok: true, skipped: "not a debit transaction" });
  }

  const input = buildEntryInput("expense", {
    type: "expense",
    title: a.merchant || "Payment",
    summary: a.thought || `Auto-logged from SMS`,
    details: `Auto-captured from SMS:\n${text}`,
    amount: String(a.amount),
    category: a.category || "Other",
    recurring: "one-time",
  });
  if (!input?.title) return Response.json({ error: "Couldn't structure the expense." }, { status: 422 });

  const entry = await createEntry(input);
  // Attach the grounded thought so it shows on the entry.
  if (a.thought) {
    const f = parseFields(entry.fields);
    f.aiThought = a.thought;
    await prisma.entry.update({ where: { id: entry.id }, data: { fields: JSON.stringify(f) } });
  }
  await logAction({
    capability: "gmail.capture",
    summary: `From SMS → expense: ${a.merchant} (${formatMoney(a.amount)})`,
    reason: "A payment SMS — auto-logged and categorized so your spending stays current without opening the app.",
    source: "user",
    entityId: entry.id,
  });

  if (pushEnabled() && a.thought) {
    await sendPushToAll({
      title: `${formatMoney(a.amount)} · ${a.merchant}`,
      body: a.thought,
      url: `/entry/${entry.id}`,
      tag: "lattice-spend",
      entryId: entry.id,
      // Tap-to-rate straight from the notification.
      actions: [
        { action: "worth", title: "👍 Worth it" },
        { action: "regret", title: "👎 Regret" },
      ],
    }).catch(() => {});
  }

  return Response.json({ ok: true, created: entry.id, amount: a.amount, category: a.category, thought: a.thought });
}
