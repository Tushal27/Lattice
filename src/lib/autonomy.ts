import { calendarConnected, createEvent } from "@/lib/calendar";
import { getTrust, logAction } from "@/lib/capabilities";
import { prisma } from "@/lib/db";
import { decisionsAwaitingReview, resurface } from "@/lib/entries";
import { activeInsights } from "@/lib/insights";
import { moneyGoalRisks } from "@/lib/money";
import { pushEnabled, sendPushToAll } from "@/lib/push";

// The autonomy engine — the "act, then report" tier. It runs from the cron/event
// path and only acts on capabilities the user has dialed to AUTO; the ASK tier is
// already served by insights + the brief, so this never duplicates those nudges.
// Every action is trust-gated, deduped, and written to the audit log.

async function readSet(key: string): Promise<Set<string>> {
  const row = await prisma.appState.findUnique({ where: { key } });
  try {
    return new Set((JSON.parse(row?.value ?? "[]") as string[]) ?? []);
  } catch {
    return new Set();
  }
}

async function writeSet(key: string, set: Set<string>): Promise<void> {
  const value = JSON.stringify([...set].slice(-500));
  await prisma.appState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// True at most once per calendar day for a given key (records the run).
async function onceToday(key: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.appState.findUnique({ where: { key } });
  if (row?.value === today) return false;
  await prisma.appState.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
  return true;
}

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export interface AutonomyResult {
  scheduled: number;
  nudged: string[];
  actions: string[];
}

export async function runAutonomy(): Promise<AutonomyResult> {
  const actions: string[] = [];
  const nudged: string[] = [];
  let scheduled = 0;

  // 1. Auto-schedule decision reviews onto the calendar. Double-gated: the
  //    autonomy dial AND the calendar-write capability must both allow it.
  if ((await getTrust("autonomy.schedule_reviews")) === "auto") {
    if ((await calendarConnected()) && (await getTrust("calendar.create_event")) !== "off") {
      const due = await decisionsAwaitingReview(14);
      const seen = await readSet("autonomy:scheduled-reviews");
      const fresh = due.filter((d) => !seen.has(d.id)).slice(0, 5);
      for (const d of fresh) {
        const start = tomorrowAt(9);
        const ev = await createEvent({
          summary: `Review decision: ${d.title}`,
          description: "Lattice: enough time has passed — judge how this decision actually turned out.",
          start,
          end: new Date(start.getTime() + 30 * 60000),
        });
        if (ev) {
          scheduled++;
          seen.add(d.id);
          await logAction({
            capability: "autonomy.schedule_reviews",
            summary: `Scheduled a review block: ${d.title}`,
            source: "autonomous",
            entityId: d.id,
          });
        }
      }
      if (scheduled > 0) {
        await writeSet("autonomy:scheduled-reviews", seen);
        actions.push(`Scheduled ${scheduled} decision review${scheduled > 1 ? "s" : ""}`);
      }
    }
  }

  // 2. Resurface forgotten work — a single gentle nudge per day.
  if ((await getTrust("autonomy.resurface")) === "auto" && (await onceToday("autonomy:resurface:lastrun"))) {
    const items = await resurface(3);
    if (items.length && pushEnabled()) {
      const r = await sendPushToAll({
        title: "Worth revisiting",
        body: items.slice(0, 2).map((i) => i.title).join(" · "),
        url: "/review",
        tag: "lattice-resurface",
      });
      if (r.sent) {
        nudged.push("resurface");
        actions.push(`Resurfaced ${items.length} buried item${items.length > 1 ? "s" : ""}`);
        await logAction({ capability: "autonomy.resurface", summary: `Resurfaced ${items.length} buried item(s)`, source: "autonomous" });
      }
    }
  }

  // 3. Spending-drift / goal-risk intervention — one nudge per day.
  if ((await getTrust("autonomy.spending_alert")) === "auto" && (await onceToday("autonomy:spending:lastrun"))) {
    const [risks, insights] = await Promise.all([moneyGoalRisks(), activeInsights(20)]);
    const drift = insights.find((i) => i.type === "SpendingDrift" || i.type === "RegretPattern");
    let body = "";
    if (drift) body = drift.title;
    else if (risks.length) body = `${risks.length} financial goal${risks.length > 1 ? "s are" : " is"} falling behind`;
    if (body && pushEnabled()) {
      const r = await sendPushToAll({ title: "Money check", body, url: "/money", tag: "lattice-money" });
      if (r.sent) {
        nudged.push("spending");
        actions.push(`Flagged money: ${body}`);
        await logAction({ capability: "autonomy.spending_alert", summary: `Flagged: ${body}`, source: "autonomous" });
      }
    }
  }

  return { scheduled, nudged, actions };
}
