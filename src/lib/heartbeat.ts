import { getAutonomyConfig, runAutonomy } from "@/lib/autonomy";
import { dailyBrief, reflection } from "@/lib/companion";
import { prisma } from "@/lib/db";
import { refreshInsights } from "@/lib/insights";
import { drainJobs } from "@/lib/jobs";
import { weeklySpendTrend } from "@/lib/money";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// The heartbeat. Two ways in:
//  • Vercel Cron at fixed UTC times passes ?slot=morning|evening — the SCHEDULE
//    encodes the timing, so briefs fire correctly with zero timezone config.
//  • GitHub Actions every ~15 min calls it with no slot — that just drains the
//    job queue and runs autonomy, for responsiveness.
// Idempotent: each slot's brief fires at most once per day.

type Slot = "morning" | "evening" | null;

async function onceToday(key: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.appState.findUnique({ where: { key } });
  if (row?.value === today) return false;
  await prisma.appState.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
  return true;
}

function trim(text: string): string {
  let t = text.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();
  if (t.length > 180) t = t.slice(0, 177).trimEnd() + "…";
  return t;
}

async function pushBrief(kind: "morning" | "evening"): Promise<boolean> {
  const body = trim((await dailyBrief(kind)).text);
  if (!body) return false;
  const r = await sendPushToAll({ title: kind === "evening" ? "Your evening brief" : "Your morning brief", body, url: "/", tag: "lattice-brief" });
  return r.sent > 0;
}

export interface HeartbeatResult {
  slot: Slot;
  drained: { ran: number; done: number; failed: number };
  sent: string[];
  autonomy: { scheduled: number; nudged: string[]; actions: string[] };
}

export async function runHeartbeat(slot: Slot = null): Promise<HeartbeatResult> {
  await prisma.appState
    .upsert({ where: { key: "hb:last" }, create: { key: "hb:last", value: new Date().toISOString() }, update: { value: new Date().toISOString() } })
    .catch(() => {});

  // Always: drain queued work (research, ingestion, etc.).
  const drained = await drainJobs().catch(() => ({ ran: 0, done: 0, failed: 0 }));

  // Slot-driven briefs — timing comes from the cron schedule, not from a tz the
  // user might never have set. Each slot fires once per day.
  const sent: string[] = [];
  if (slot && pushEnabled() && (await onceToday(`hb:brief:${slot}`))) {
    await refreshInsights({ force: true }).catch(() => {});
    if (await pushBrief(slot)) sent.push(slot);

    if (slot === "evening") {
      const cfg = await getAutonomyConfig();
      const day = new Date(Date.now() + cfg.tz * 60000).getUTCDay(); // 0 = Sunday
      if (day === 0 && (await onceToday("hb:weekly"))) {
        const body = trim((await reflection("week")).text);
        if (body) {
          await sendPushToAll({ title: "Your week in review", body, url: "/reflect", tag: "lattice-weekly" });
          sent.push("weekly");
        }
        const trend = await weeklySpendTrend().catch(() => null);
        if (trend) {
          await sendPushToAll({ title: "Your spending this week", body: trend, url: "/money", tag: "lattice-spend-trend" });
          sent.push("spend-trend");
        }
      }
    }
  }

  // Act on the user's behalf (Auto-trust only; each step self-guards).
  const autonomy = await runAutonomy().catch(() => ({ scheduled: 0, nudged: [], actions: [] as string[] }));

  return { slot, drained, sent, autonomy };
}
