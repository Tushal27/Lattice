import { getAutonomyConfig, runAutonomy } from "@/lib/autonomy";
import { dailyBrief, reflection } from "@/lib/companion";
import { prisma } from "@/lib/db";
import { refreshInsights } from "@/lib/insights";
import { drainJobs } from "@/lib/jobs";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// The heartbeat: one idempotent endpoint safe to call as often as every few
// minutes (driven by GitHub Actions, with Vercel Cron as a fallback). Time-gated
// guards make each thing happen at most once per slot per day, so frequency only
// improves responsiveness — it never causes spam or duplicate work.

async function onceToday(key: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.appState.findUnique({ where: { key } });
  if (row?.value === today) return false;
  await prisma.appState.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
  return true;
}

function localParts(tzMin: number): { hour: number; day: number } {
  const d = new Date(Date.now() + tzMin * 60000);
  return { hour: d.getUTCHours(), day: d.getUTCDay() };
}

function trim(text: string): string {
  let t = text.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();
  if (t.length > 180) t = t.slice(0, 177).trimEnd() + "…";
  return t;
}

async function pushBrief(kind: "morning" | "evening"): Promise<boolean> {
  const brief = await dailyBrief(kind);
  const body = trim(brief.text);
  if (!body) return false;
  const r = await sendPushToAll({ title: kind === "evening" ? "Your evening brief" : "Your morning brief", body, url: "/", tag: "lattice-brief" });
  return r.sent > 0;
}

export interface HeartbeatResult {
  hour: number;
  drained: { ran: number; done: number; failed: number };
  sent: string[];
  autonomy: { scheduled: number; nudged: string[]; actions: string[] };
}

export async function runHeartbeat(): Promise<HeartbeatResult> {
  const cfg = await getAutonomyConfig();
  const { hour, day } = localParts(cfg.tz);

  // 1. Always drain queued background work (research, ingestion retries, etc.).
  const drained = await drainJobs().catch(() => ({ ran: 0, done: 0, failed: 0 }));

  // 2. Time-gated brief pushes — once each per day, in the right window.
  const sent: string[] = [];
  if (pushEnabled()) {
    if (hour >= 8 && hour < 20 && (await onceToday("hb:morning"))) {
      await refreshInsights({ force: true }).catch(() => {});
      if (await pushBrief("morning")) sent.push("morning");
    }
    if (hour >= 20 && (await onceToday("hb:evening"))) {
      await refreshInsights({ force: true }).catch(() => {});
      if (await pushBrief("evening")) sent.push("evening");
      if (day === 0 && (await onceToday("hb:weekly"))) {
        const body = trim((await reflection("week")).text);
        if (body) {
          await sendPushToAll({ title: "Your week in review", body, url: "/reflect", tag: "lattice-weekly" });
          sent.push("weekly");
        }
      }
    }
  }

  // 3. Act on the user's behalf (Auto-trust only; each step has its own guards).
  const autonomy = await runAutonomy().catch(() => ({ scheduled: 0, nudged: [], actions: [] as string[] }));

  return { hour, drained, sent, autonomy };
}
