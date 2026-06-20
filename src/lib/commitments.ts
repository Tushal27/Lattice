import { prisma } from "@/lib/db";

// ---- natural-language scheduling -------------------------------------------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Apply a time-of-day phrase to a date, defaulting to 9am. Returns false if none found. */
function applyTime(d: Date, text: string): boolean {
  // "at 9", "9am", "9:30pm", "17:00", "noon", "midnight", "morning", "evening"
  if (/\bnoon\b/.test(text)) { d.setHours(12, 0, 0, 0); return true; }
  if (/\bmidnight\b/.test(text)) { d.setHours(0, 0, 0, 0); return true; }
  if (/\bmorning\b/.test(text)) { d.setHours(9, 0, 0, 0); return true; }
  if (/\b(after ?noon)\b/.test(text)) { d.setHours(14, 0, 0, 0); return true; }
  if (/\b(evening|tonight)\b/.test(text)) { d.setHours(19, 0, 0, 0); return true; }
  const m = text.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (m && (m[3] || /\bat\b/.test(text))) {
    let hr = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (hr <= 23) {
      if (m[3] === "pm" && hr < 12) hr += 12;
      if (m[3] === "am" && hr === 12) hr = 0;
      d.setHours(hr, min, 0, 0);
      return true;
    }
  }
  return false;
}

/**
 * Parse a natural-language (or ISO) due phrase into a Date. Returns null when
 * nothing date-like is found, so the caller can leave a commitment undated.
 * Used by both the API and the agent's create_commitment tool.
 */
export function parseDueDate(input: string | null | undefined, now = new Date()): Date | null {
  if (!input) return null;
  const text = input.toLowerCase().trim();
  if (!text) return null;

  // ISO date (optionally with time): 2026-06-25 or 2026-06-25T14:00
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?\b/);
  if (iso) {
    const d = new Date(now);
    d.setFullYear(+iso[1], +iso[2] - 1, +iso[3]);
    if (iso[4]) d.setHours(+iso[4], +iso[5], 0, 0);
    else if (!applyTime(d, text)) d.setHours(9, 0, 0, 0);
    return d;
  }

  const startOf = (d: Date) => { if (!applyTime(d, text)) d.setHours(9, 0, 0, 0); return d; };

  if (/\b(today|tonight)\b/.test(text)) return startOf(new Date(now));
  if (/\btomorrow\b/.test(text)) { const d = new Date(now); d.setDate(d.getDate() + 1); return startOf(d); }
  if (/\bday after tomorrow\b/.test(text)) { const d = new Date(now); d.setDate(d.getDate() + 2); return startOf(d); }

  // "in 3 days", "in 2 weeks", "in a month"
  const rel = text.match(/\bin\s+(a|an|\d+)\s+(day|week|month|year)s?\b/);
  if (rel) {
    const n = rel[1] === "a" || rel[1] === "an" ? 1 : parseInt(rel[1], 10);
    const d = new Date(now);
    if (rel[2] === "day") d.setDate(d.getDate() + n);
    else if (rel[2] === "week") d.setDate(d.getDate() + n * 7);
    else if (rel[2] === "month") d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);
    return startOf(d);
  }

  if (/\bnext week\b/.test(text)) { const d = new Date(now); d.setDate(d.getDate() + 7); return startOf(d); }
  if (/\bnext month\b/.test(text)) { const d = new Date(now); d.setMonth(d.getMonth() + 1); return startOf(d); }
  if (/\b(this )?weekend\b/.test(text)) {
    const d = new Date(now);
    const day = d.getDay();
    const add = (6 - day + 7) % 7 || 6; // upcoming Saturday
    d.setDate(d.getDate() + add);
    return startOf(d);
  }

  // weekday name: "monday", "next friday"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) {
      const d = new Date(now);
      const isNext = /\bnext\b/.test(text);
      let add = (i - d.getDay() + 7) % 7;
      if (add === 0) add = 7; // always future
      if (isNext && add <= 7) add += 0; // "next monday" ~ the coming monday already future
      d.setDate(d.getDate() + add);
      return startOf(d);
    }
  }

  // "june 25", "25 june", "jun 25"
  for (let i = 0; i < MONTHS.length; i++) {
    const mn = MONTHS[i];
    const abbr = mn.slice(0, 3);
    const re = new RegExp(`\\b(?:${mn}|${abbr})\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+(?:${mn}|${abbr})\\b`);
    const mm = text.match(re);
    if (mm) {
      const dayNum = parseInt(mm[1] || mm[2], 10);
      const d = new Date(now);
      d.setMonth(i, dayNum);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return startOf(d);
    }
  }

  return null;
}

/** Detect a recurrence rule in free text ("every day", "weekly", "each monday"). */
export function parseRecurrence(input: string | null | undefined): string | null {
  if (!input) return null;
  const t = input.toLowerCase();
  // "every morning/evening/night", "nightly", "daily", "each day"
  if (/\b(every\s*(day|morning|evening|night|afternoon)|daily|nightly|each day)\b/.test(t)) return "daily";
  if (/\b(every ?month|monthly|each month)\b/.test(t)) return "monthly";
  if (/\b(every ?week|weekly|each week)\b/.test(t)) return "weekly";
  const wd = WEEKDAYS.find((d) => new RegExp(`\\bevery\\s+${d}\\b`).test(t));
  if (wd) return `weekly:${wd.slice(0, 3)}`;
  return null;
}

/**
 * The first due date for a recurring commitment that the user didn't pin to a
 * specific day — e.g. "every morning" → today at 9am (or tomorrow if past).
 */
export function seedRecurringDue(rule: string, text: string, now = new Date()): Date {
  const d = new Date(now);
  if (!applyTime(d, text)) {
    // sensible default times by phrasing
    if (/\b(evening|night)\b/.test(text.toLowerCase())) d.setHours(19, 0, 0, 0);
    else d.setHours(9, 0, 0, 0);
  }
  // If today's slot already passed, start at the next occurrence.
  if (d < now) return nextOccurrence(rule, d);
  return d;
}

export interface CommitmentInput {
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  recurringRule?: string | null;
  priority?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

export async function createCommitment(input: CommitmentInput) {
  return prisma.commitment.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      recurringRule: input.recurringRule ?? null,
      priority: input.priority ?? null,
      sourceType: input.sourceType ?? "manual",
      sourceId: input.sourceId ?? null,
    },
  });
}

export async function updateCommitment(
  id: string,
  data: { title?: string; dueDate?: Date | null; priority?: string | null; description?: string | null },
) {
  return prisma.commitment.update({ where: { id }, data });
}

export async function cancelCommitment(id: string) {
  return prisma.commitment.update({ where: { id }, data: { status: "cancelled" } });
}

export async function deleteCommitment(id: string) {
  return prisma.commitment.delete({ where: { id } });
}

/** Advance a recurring rule from a base date to the next occurrence. */
function nextOccurrence(rule: string, from: Date): Date {
  const d = new Date(from);
  const base = rule.split(":")[0].toLowerCase();
  if (base === "daily") d.setDate(d.getDate() + 1);
  else if (base === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 7); // weekly (default)
  return d;
}

/** Mark complete; for recurring commitments, spawn the next occurrence. */
export async function completeCommitment(id: string) {
  const c = await prisma.commitment.findUnique({ where: { id } });
  if (!c) throw new Error("Not found");
  const done = await prisma.commitment.update({
    where: { id },
    data: { status: "done", completedAt: new Date() },
  });
  if (c.recurringRule && c.status === "open") {
    await prisma.commitment.create({
      data: {
        title: c.title,
        description: c.description,
        dueDate: nextOccurrence(c.recurringRule, c.dueDate ?? new Date()),
        recurringRule: c.recurringRule,
        priority: c.priority,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
      },
    });
  }
  return done;
}

export async function snoozeCommitment(id: string, days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return prisma.commitment.update({ where: { id }, data: { dueDate: d, status: "open" } });
}

export type CommitmentRow = Awaited<ReturnType<typeof createCommitment>>;

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function groupedCommitments() {
  const open = await prisma.commitment.findMany({
    where: { status: "open" },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const recentDone = await prisma.commitment.findMany({
    where: { status: "done" },
    orderBy: { completedAt: "desc" },
    take: 10,
  });

  const todayEnd = endOfToday();
  const overdue = open.filter((c) => c.dueDate && c.dueDate < startOfToday());
  const today = open.filter((c) => c.dueDate && c.dueDate >= startOfToday() && c.dueDate <= todayEnd);
  const upcoming = open.filter((c) => !c.dueDate || c.dueDate > todayEnd);
  return { overdue, today, upcoming, done: recentDone };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Counts for badges / dashboard: overdue + due today. */
export async function commitmentCounts() {
  const open = await prisma.commitment.findMany({ where: { status: "open" }, select: { dueDate: true } });
  const todayEnd = endOfToday();
  let overdue = 0;
  let today = 0;
  for (const c of open) {
    if (!c.dueDate) continue;
    if (c.dueDate < startOfToday()) overdue++;
    else if (c.dueDate <= todayEnd) today++;
  }
  return { overdue, today, due: overdue + today };
}

/** Longer-horizon analytics: completions over the last 6 weeks + by source. */
export async function commitmentAnalytics() {
  const all = await prisma.commitment.findMany({ select: { status: true, completedAt: true, sourceType: true } });
  const now = Date.now();

  // weeks[5] = current 7-day window, weeks[0] = five weeks ago.
  const weeks = Array.from({ length: 6 }, () => 0);
  for (const c of all) {
    if (!c.completedAt) continue;
    const w = Math.floor((now - new Date(c.completedAt).getTime()) / (7 * 86_400_000));
    if (w >= 0 && w < 6) weeks[5 - w]++;
  }

  const bySource: Record<string, { done: number; total: number }> = {};
  for (const c of all) {
    const k = c.sourceType || "manual";
    (bySource[k] ??= { done: 0, total: 0 }).total++;
    if (c.status === "done") bySource[k].done++;
  }

  return { weeks, bySource };
}

/** A guilt-free weekly review: completion, streak, areas. */
export async function commitmentWeeklyReview() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [completedThisWeek, all] = await Promise.all([
    prisma.commitment.findMany({ where: { status: "done", completedAt: { gte: weekAgo } } }),
    prisma.commitment.findMany({ select: { status: true, dueDate: true, completedAt: true } }),
  ]);

  const missed = all.filter((c) => c.status === "open" && c.dueDate && c.dueDate < startOfToday()).length;
  const completed = completedThisWeek.length;
  const denom = completed + missed;
  const completionPct = denom > 0 ? Math.round((completed / denom) * 100) : null;

  // Current streak: consecutive days (back from today) with ≥1 completion.
  const doneDays = new Set(
    all
      .filter((c) => c.completedAt)
      .map((c) => new Date(c.completedAt as Date).toDateString()),
  );
  let streak = 0;
  const cursor = new Date();
  // allow today to not yet have one without breaking streak
  if (!doneDays.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (doneDays.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { completed, missed, completionPct, streak };
}
