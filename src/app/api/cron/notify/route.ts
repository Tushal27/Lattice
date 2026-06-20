import { groupedCommitments } from "@/lib/commitments";
import { refreshInsights } from "@/lib/insights";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// Periodic proactive check — wired to a Vercel Cron (see vercel.json). Recomputes
// insight triggers and, if Web Push is configured, sends a short daily digest of
// what's due and what's new. Safe to call manually for testing.

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const url = new URL(request.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const [insights, commitments] = await Promise.all([refreshInsights(), groupedCommitments()]);
  const due = commitments.overdue.length + commitments.today.length;

  let sent = 0;
  if (pushEnabled()) {
    const lines: string[] = [];
    if (due > 0) lines.push(`🎯 ${due} commitment${due > 1 ? "s" : ""} due`);
    if (insights.length > 0) lines.push(`💡 ${insights.length} insight${insights.length > 1 ? "s" : ""} waiting`);
    if (lines.length) {
      const r = await sendPushToAll({
        title: "Lattice",
        body: lines.join(" · "),
        url: due > 0 ? "/commitments" : "/",
        tag: "lattice-digest",
      });
      sent = r.sent;
    }
  }

  return Response.json({ ok: true, due, insights: insights.length, pushed: sent, pushEnabled: pushEnabled() });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
