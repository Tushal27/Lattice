import { calendarConnected, createEvent } from "@/lib/calendar";
import { getTrust, logAction } from "@/lib/capabilities";
import { prisma } from "@/lib/db";
import { researchQuestion } from "@/lib/companion";
import { decisionsAwaitingReview, resurface } from "@/lib/entries";
import { gmailConnected } from "@/lib/gmail";
import { runInboxScan } from "@/lib/inbox";
import { activeInsights } from "@/lib/insights";
import { moneyGoalRisks } from "@/lib/money";
import { pushEnabled, sendPushToAll } from "@/lib/push";
import { parseFields } from "@/lib/utils";

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

// ---- tunable config --------------------------------------------------------

export interface AutonomyConfig {
  reviewAgeDays: number; // how old a decision must be before auto-scheduling a review
  scheduleHour: number; // local hour to place review blocks at
  quietStart: number; // local hour quiet period starts (no push nudges)
  quietEnd: number; // local hour quiet period ends
  tz: number; // minutes east of UTC (e.g. IST = +330)
}

const DEFAULT_CONFIG: AutonomyConfig = { reviewAgeDays: 14, scheduleHour: 9, quietStart: 22, quietEnd: 7, tz: 0 };
const CONFIG_KEY = "autonomy:config";

export async function getAutonomyConfig(): Promise<AutonomyConfig> {
  const row = await prisma.appState.findUnique({ where: { key: CONFIG_KEY } });
  if (!row) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(row.value) as Partial<AutonomyConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setAutonomyConfig(patch: Partial<AutonomyConfig>): Promise<AutonomyConfig> {
  const next = { ...(await getAutonomyConfig()), ...patch };
  await prisma.appState.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

// The instant corresponding to tomorrow at `hour`:00 in the user's local time.
function tomorrowAtLocal(hour: number, tzMin: number): Date {
  const local = new Date(Date.now() + tzMin * 60000); // shift so UTC fields read as wall clock
  local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(hour, 0, 0, 0);
  return new Date(local.getTime() - tzMin * 60000);
}

// Don't send push nudges during the user's quiet hours (handles overnight wrap).
function inQuietHours(cfg: AutonomyConfig): boolean {
  const localHour = new Date(Date.now() + cfg.tz * 60000).getUTCHours();
  const { quietStart: s, quietEnd: e } = cfg;
  if (s === e) return false;
  return s < e ? localHour >= s && localHour < e : localHour >= s || localHour < e;
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
  const cfg = await getAutonomyConfig();
  const quiet = inQuietHours(cfg);

  // 1. Auto-schedule decision reviews onto the calendar. Double-gated: the
  //    autonomy dial AND the calendar-write capability must both allow it.
  if ((await getTrust("autonomy.schedule_reviews")) === "auto") {
    if ((await calendarConnected()) && (await getTrust("calendar.create_event")) !== "off") {
      const due = await decisionsAwaitingReview(cfg.reviewAgeDays);
      const seen = await readSet("autonomy:scheduled-reviews");
      const fresh = due.filter((d) => !seen.has(d.id)).slice(0, 5);
      for (const d of fresh) {
        const start = tomorrowAtLocal(cfg.scheduleHour, cfg.tz);
        const ageDays = Math.max(1, Math.round((Date.now() - new Date(d.createdAt).getTime()) / 86_400_000));
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
            reason: `Decided ${ageDays} days ago and still ungraded — past the ${cfg.reviewAgeDays}-day review window, so its outcome is worth judging now.`,
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

  // 1b. Auto-triage the inbox (when Gmail capture is on Auto): action items →
  //     commitments, reply-worthy mail → draft replies, renewals → alerts.
  if ((await getTrust("gmail.capture")) === "auto" && (await gmailConnected()) && (await onceToday("autonomy:inbox:lastrun"))) {
    const r = await runInboxScan(cfg.tz).catch(() => null);
    if (r && (r.created.length || r.proposed)) {
      actions.push(`Inbox: ${r.created.length} action item(s), ${r.replies} reply draft(s), ${r.renewals} renewal alert(s)`);
      if (!quiet && pushEnabled() && (r.replies || r.created.length)) {
        await sendPushToAll({
          title: "Inbox triaged",
          body: [r.created.length ? `${r.created.length} to do` : "", r.replies ? `${r.replies} reply draft(s)` : ""].filter(Boolean).join(" · "),
          url: "/settings#integrations",
          tag: "lattice-inbox",
        });
      }
    }
  }

  // 1c. Auto-research open questions → a draft answer attached to each question.
  if ((await getTrust("autonomy.research_questions")) === "auto") {
    const questions = await prisma.entry.findMany({
      where: { type: "question", status: "open" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, summary: true, fields: true },
    });
    const undrafted = questions.filter((q) => !parseFields(q.fields).aiDraft).slice(0, 3);
    let drafted = 0;
    for (const q of undrafted) {
      const draft = await researchQuestion(q.title, q.summary ?? "").catch(() => null);
      if (!draft) continue;
      const f = parseFields(q.fields);
      f.aiDraft = draft;
      f.aiDraftAt = new Date().toISOString();
      await prisma.entry.update({ where: { id: q.id }, data: { fields: JSON.stringify(f) } });
      drafted++;
      await logAction({
        capability: "autonomy.research_questions",
        summary: `Drafted an answer to: ${q.title}`,
        reason: "You left this question open; I researched a first-draft answer from your notes for you to react to.",
        source: "autonomous",
        entityId: q.id,
      });
    }
    if (drafted) {
      actions.push(`Drafted answers to ${drafted} open question${drafted > 1 ? "s" : ""}`);
      if (!quiet && pushEnabled()) {
        await sendPushToAll({ title: "Draft answers ready", body: `I drafted answers to ${drafted} of your open questions`, url: "/questions", tag: "lattice-research" });
      }
    }
  }

  // 2. Resurface forgotten work — a single gentle nudge per day, outside quiet hours.
  if (!quiet && (await getTrust("autonomy.resurface")) === "auto" && (await onceToday("autonomy:resurface:lastrun"))) {
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
        await logAction({
          capability: "autonomy.resurface",
          summary: `Resurfaced ${items.length} buried item(s)`,
          reason: `These have gone quiet (e.g. “${items[0].title}”). A timed nudge keeps old lessons working instead of being forgotten.`,
          source: "autonomous",
        });
      }
    }
  }

  // 3. Spending-drift / goal-risk intervention — one nudge per day, outside quiet hours.
  if (!quiet && (await getTrust("autonomy.spending_alert")) === "auto" && (await onceToday("autonomy:spending:lastrun"))) {
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
        await logAction({
          capability: "autonomy.spending_alert",
          summary: `Flagged: ${body}`,
          reason: drift
            ? "A spending/regret pattern crossed the threshold worth your attention."
            : "At the current contribution pace, the projection shows the goal missing its deadline.",
          source: "autonomous",
        });
      }
    }
  }

  return { scheduled, nudged, actions };
}
