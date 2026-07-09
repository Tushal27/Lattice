import { createHash } from "crypto";
import { aiEnabled } from "@/lib/ai";
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

// Dedupe only within a short window — enough to catch the same SMS delivered
// twice (multipart quirks / retries), without permanently blocking a repeated
// test or a genuinely recurring identical charge.
const DEDUP_WINDOW_MS = 10 * 60 * 1000;

interface SeenEntry {
  h: string;
  t: number;
}

async function readSeen(): Promise<SeenEntry[]> {
  const row = await prisma.appState.findUnique({ where: { key: SEEN_KEY } });
  try {
    const parsed = JSON.parse(row?.value ?? "[]") as unknown[];
    // Migrate the old string[] format (t=0 → pruned immediately).
    return parsed
      .map((x) => (typeof x === "string" ? { h: x, t: 0 } : (x as SeenEntry)))
      .filter((e) => e && typeof e.h === "string");
  } catch {
    return [];
  }
}

async function alreadySeen(text: string): Promise<boolean> {
  const hash = createHash("sha1").update(text.trim()).digest("hex").slice(0, 16);
  const now = Date.now();
  const seen = (await readSeen()).filter((e) => now - e.t < DEDUP_WINDOW_MS);
  if (seen.some((e) => e.h === hash)) return true;
  seen.push({ h: hash, t: now });
  await prisma.appState.upsert({
    where: { key: SEEN_KEY },
    create: { key: SEEN_KEY, value: JSON.stringify(seen.slice(-500)) },
    update: { value: JSON.stringify(seen.slice(-500)) },
  });
  return false;
}

// Accept the SMS text from wherever it's easiest for the phone automation app:
// a ?text= query param (simplest — GET works), a JSON body, or a form body.
async function readText(request: Request, url: URL): Promise<string> {
  const q = url.searchParams.get("text") || url.searchParams.get("message") || url.searchParams.get("sms");
  if (q) return q.trim();
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const b = (await request.json()) as { text?: string; message?: string; sms?: string };
      return String(b.text ?? b.message ?? b.sms ?? "").trim();
    }
    if (ct.includes("form")) {
      const f = await request.formData();
      return String(f.get("text") ?? f.get("message") ?? f.get("sms") ?? "").trim();
    }
    return (await request.text()).trim();
  } catch {
    return "";
  }
}

async function handle(request: Request) {
  const url = new URL(request.url);
  if (!(await authed(request, url))) return new Response("Unauthorized", { status: 401 });

  const text = await readText(request, url);
  if (!text) return Response.json({ error: "No SMS text provided." }, { status: 400 });

  if (await alreadySeen(text)) return Response.json({ ok: true, skipped: "duplicate" });

  const a = await analyzeSpendSms(text);
  if (!a || !a.isTransaction || !a.debit || a.amount <= 0) {
    // Record the arrival so you can confirm forwarding works and see WHY it
    // wasn't logged (shows up in Settings → Activity).
    const why = !a ? "couldn't parse" : !a.isTransaction ? "not a transaction" : !a.debit ? "not a debit (credit/refund)" : "no amount found";
    await logAction({
      capability: "gmail.capture",
      summary: `SMS received, not logged (${why}): "${text.slice(0, 70)}"`,
      reason: "Forwarded from your phone but didn't read as an outgoing payment.",
      source: "user",
    }).catch(() => {});
    return Response.json({ ok: true, skipped: why });
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

// A no-guessing audit: hit /api/sms?diag=1&secret=YOUR_SECRET in a browser to
// see whether SMS are actually reaching the server, how many were logged vs
// skipped, and why.
async function diagnostic(): Promise<Response> {
  const secret = process.env.SMS_INGEST_SECRET || process.env.CRON_SECRET;
  const seen = await readSeen();
  const recent = await prisma.actionLog.findMany({
    where: { capability: "gmail.capture" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { summary: true, createdAt: true },
  });
  const sms = recent.filter((r) => /SMS/i.test(r.summary));
  return Response.json({
    ok: true,
    secretRequired: Boolean(secret),
    aiEnabled: aiEnabled(),
    dedupWindowMinutes: DEDUP_WINDOW_MS / 60000,
    recentlySeenCount: seen.filter((e) => Date.now() - e.t < DEDUP_WINDOW_MS).length,
    smsArrivalsLogged: sms.length,
    recentSms: sms.map((r) => ({ at: r.createdAt, summary: r.summary })),
    hint:
      sms.length === 0
        ? "No SMS have reached the server. If real payments aren't here, the phone isn't forwarding — check SMS permission + Auto-start/battery for Lattice."
        : "SMS are reaching the server. If an expense is missing, check its summary above for the skip reason.",
  });
}

// Both verbs work, so the phone app can use whichever is simplest (a GET with
// ?text=… is the easiest to set up). ?diag=1 returns the audit above.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("diag")) {
    if (!(await authed(request, url))) return new Response("Unauthorized", { status: 401 });
    return diagnostic();
  }
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
