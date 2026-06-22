import { runAutonomy } from "@/lib/autonomy";
import { dailyBrief } from "@/lib/companion";
import { groupedCommitments } from "@/lib/commitments";
import { refreshInsights } from "@/lib/insights";
import { drainJobs } from "@/lib/jobs";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// Periodic proactive check — wired to Vercel Cron (see vercel.json), morning and
// evening. Recomputes insight triggers and, if Web Push is configured, sends the
// assistant's brief straight to the user's phone — presence, not just reminders.
// Safe to call manually for testing (add ?kind=evening to force the evening one).

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "morning" || kindParam === "evening" ? kindParam : "auto";

  // Cron does the heavy pass: force a recompute and allow embedding backfill.
  const [insights, commitments, brief] = await Promise.all([
    refreshInsights({ force: true, embed: true }),
    groupedCommitments(),
    dailyBrief(kind),
  ]);
  const due = commitments.overdue.length + commitments.today.length;

  // Drain any queued background work, then act on the user's behalf (AUTO-trust
  // capabilities only; deduped + audited).
  await drainJobs().catch(() => ({ ran: 0, done: 0, failed: 0 }));
  const autonomy = await runAutonomy().catch(() => ({ scheduled: 0, nudged: [], actions: [] as string[] }));

  let sent = 0;
  if (pushEnabled()) {
    // The brief itself is the notification body — intelligence-driven, not spam.
    // Trim to a phone-notification length; fall back to a terse digest.
    let body = brief.text.replace(/[#*_`]/g, "").replace(/\s+/g, " ").trim();
    if (body.length > 180) body = body.slice(0, 177).trimEnd() + "…";
    if (!body) {
      const lines: string[] = [];
      if (due > 0) lines.push(`🎯 ${due} due`);
      if (insights.length > 0) lines.push(`💡 ${insights.length} insight${insights.length > 1 ? "s" : ""}`);
      body = lines.join(" · ");
    }
    if (body) {
      const heading = (kind === "auto" ? (new Date().getHours() < 16 ? "morning" : "evening") : kind) === "evening"
        ? "Your evening brief"
        : "Your morning brief";
      const r = await sendPushToAll({ title: heading, body, url: "/", tag: "lattice-brief" });
      sent = r.sent;
    }
  }

  return Response.json({ ok: true, kind, due, insights: insights.length, pushed: sent, pushEnabled: pushEnabled(), autonomy });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
