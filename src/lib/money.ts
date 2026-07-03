// Money OS analytics — the "wisdom" layer. Not accounting: every number here is
// in service of the question "did this spending create value?". Amounts and
// satisfaction live in the entry `fields` JSON and are parsed here.

import { prisma } from "@/lib/db";
import { formatMoney, parseAmount, projectGoal, type GoalProjection } from "@/lib/format";
import { parseFields } from "@/lib/utils";

export { parseAmount } from "@/lib/format";
export { formatMoney };
export type { GoalProjection } from "@/lib/format";

export interface ProjectedGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  monthly: number;
  monthlyFromLink: boolean;
  deadline: string | null;
  pct: number;
  projection: GoalProjection;
}

/**
 * Goals with a compound-growth projection. The monthly contribution is the
 * goal's explicit `monthly` field, or — failing that — the sum of monthly SIP
 * investments LINKED to the goal in the graph, so connections carry real meaning.
 */
export async function goalsWithProjection(): Promise<ProjectedGoal[]> {
  const [goals, investments, connections] = await Promise.all([
    prisma.entry.findMany({ where: { type: "goal" }, select: { id: true, title: true, fields: true, status: true } }),
    prisma.entry.findMany({ where: { type: "investment" }, select: { id: true, fields: true, status: true, occurredAt: true, createdAt: true } }),
    prisma.connection.findMany({ select: { fromId: true, toId: true } }),
  ]);

  // Per active investment: its monthly-equivalent contribution (future rate),
  // and how much it has ALREADY put in (one-time lump, or every SIP installment
  // since it started) — which counts toward the goal's "already saved".
  const invInfo = new Map<string, { monthly: number; saved: number }>();
  for (const inv of investments) {
    if (inv.status === "exited") continue;
    const f = parseFields(inv.fields);
    const amount = parseAmount(f.amount);
    const freq = f.frequency || "one-time";
    const start = inv.occurredAt ?? inv.createdAt;
    const saved = amount * installmentsElapsed(start, freq);
    if (freq === "monthly") invInfo.set(inv.id, { monthly: amount, saved });
    else if (freq === "quarterly") invInfo.set(inv.id, { monthly: amount / 3, saved });
    else if (freq === "yearly") invInfo.set(inv.id, { monthly: amount / 12, saved });
    else invInfo.set(inv.id, { monthly: 0, saved });
  }
  const linkedContrib = (goalId: string) => {
    let monthly = 0;
    let saved = 0;
    for (const c of connections) {
      const other = c.fromId === goalId ? c.toId : c.toId === goalId ? c.fromId : null;
      const info = other ? invInfo.get(other) : undefined;
      if (info) {
        monthly += info.monthly;
        saved += info.saved;
      }
    }
    return { monthly, saved };
  };

  return goals
    .filter((g) => (g.status ?? "active") === "active")
    .map((g) => {
      const f = parseFields(g.fields);
      const target = parseAmount(f.amount);
      const explicit = parseAmount(f.monthly);
      const { monthly: linkedM, saved: linkedSaved } = linkedContrib(g.id);
      const current = parseAmount(f.current) + linkedSaved; // linked SIPs' contributions to date
      const monthly = explicit || linkedM;
      const annualReturnPct = parseAmount(f.expectedReturn) || (monthly > 0 ? 10 : 0);
      const deadline = f.deadline || null;
      return {
        id: g.id,
        title: g.title,
        target,
        current,
        monthly,
        monthlyFromLink: !explicit && linkedM > 0,
        deadline,
        pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
        projection: projectGoal({ target, current, monthly, annualReturnPct, deadline }),
      };
    });
}

/** Goals that, on current trajectory, will miss their target by the deadline. */
/** A one-line week-over-week spending trend, for the Sunday push. */
export async function weeklySpendTrend(): Promise<string | null> {
  const exp = (await moneyEntries()).filter((e) => e.type === "expense");
  const now = Date.now();
  const wk = 7 * 86_400_000;
  const thisWeek = exp.filter((e) => now - e.when.getTime() < wk);
  const lastWeek = exp.filter((e) => {
    const d = now - e.when.getTime();
    return d >= wk && d < 2 * wk;
  });
  if (thisWeek.length === 0 && lastWeek.length === 0) return null;

  const tw = thisWeek.reduce((s, e) => s + e.amount, 0);
  const lw = lastWeek.reduce((s, e) => s + e.amount, 0);
  const catThis = new Map<string, number>();
  for (const e of thisWeek) catThis.set(e.category, (catThis.get(e.category) ?? 0) + e.amount);
  const catLast = new Map<string, number>();
  for (const e of lastWeek) catLast.set(e.category, (catLast.get(e.category) ?? 0) + e.amount);
  const top = [...catThis.entries()].sort((a, b) => b[1] - a[1])[0];

  let line = `${formatMoney(tw)} this week across ${thisWeek.length}`;
  if (lw > 0) {
    const pct = Math.round(((tw - lw) / lw) * 100);
    line += `, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs last week`;
  }
  if (top) {
    const last = catLast.get(top[0]) ?? 0;
    const cp = last > 0 ? Math.round(((top[1] - last) / last) * 100) : null;
    line += `. Most on ${top[0]} (${formatMoney(top[1])}${cp != null ? `, ${cp >= 0 ? "+" : ""}${cp}%` : ""}).`;
  }
  return line;
}

export async function moneyGoalRisks(): Promise<ProjectedGoal[]> {
  const goals = await goalsWithProjection();
  return goals.filter((g) => g.projection.status === "behind" && g.projection.monthsLeft > 0 && g.monthly > 0);
}

export const MONEY_TYPES = ["financial-decision", "expense", "investment", "goal"];

// A single "value created" axis across money types: expenses use satisfaction,
// reviewable types use the review verdict. null = not yet judged.
const SATISFACTION_SCORE: Record<string, number> = { Regret: -1, Meh: 0, "Worth it": 1, Great: 2 };
const VERDICT_SCORE: Record<string, number> = { "Right call": 2, Mixed: 0, "Wrong call": -1 };

export function valueScore(type: string, f: Record<string, string>): number | null {
  if (type === "expense") return f.satisfaction in SATISFACTION_SCORE ? SATISFACTION_SCORE[f.satisfaction] : null;
  if (f.reviewVerdict in VERDICT_SCORE) return VERDICT_SCORE[f.reviewVerdict];
  return null;
}

export interface MoneyEntry {
  id: string;
  type: string;
  title: string;
  when: Date;
  amount: number;
  category: string;
  recurring: string;
  score: number | null;
  f: Record<string, string>;
}

async function moneyEntries(): Promise<MoneyEntry[]> {
  const rows = await prisma.entry.findMany({
    where: { type: { in: MONEY_TYPES } },
    select: { id: true, type: true, title: true, fields: true, occurredAt: true, createdAt: true, status: true },
  });
  return rows.map((r) => {
    const f = parseFields(r.fields);
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      when: r.occurredAt ?? r.createdAt,
      amount: parseAmount(f.amount),
      category: f.category || (r.type === "investment" ? "Investments" : "Uncategorized"),
      recurring: f.recurring || "one-time",
      score: valueScore(r.type, f),
      f,
      // carry status for goals/investments
      ...(r.status ? { status: r.status } : {}),
    } as MoneyEntry & { status?: string };
  });
}

export type MoneyPeriod = "month" | "quarter" | "year" | "all";

// Calendar-aligned period start (this month, this quarter, this year) — NOT a
// rolling window, so "this month" means the 1st onward, not the last 30 days.
function periodStart(period: MoneyPeriod, now = new Date()): number {
  switch (period) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case "quarter":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
    case "year":
      return new Date(now.getFullYear(), 0, 1).getTime();
    default:
      return 0;
  }
}

// How many installments a recurring contribution has made from its start date to
// now (inclusive of the first) — so a monthly SIP started in June shows 2 by
// July. One-time / unknown → 1.
export function installmentsElapsed(start: Date, frequency: string, now = new Date()): number {
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  switch (frequency) {
    case "monthly":
      return months + 1;
    case "quarterly":
      return Math.floor(months / 3) + 1;
    case "yearly":
      return Math.max(0, now.getFullYear() - start.getFullYear()) + 1;
    default:
      return 1;
  }
}

export async function moneyAnalytics(period: MoneyPeriod = "month") {
  const all = await moneyEntries();
  const since = periodStart(period);
  const inPeriod = (e: MoneyEntry) => e.when.getTime() >= since;

  const expenses = all.filter((e) => e.type === "expense");
  const expInPeriod = expenses.filter(inPeriod);
  const spendTotal = expInPeriod.reduce((s, e) => s + e.amount, 0);

  // Best / most-regretted: anything judged within the period, ranked by value
  // then amount (a great big purchase beats a great tiny one).
  const judged = all.filter((e) => e.score != null && inPeriod(e));
  const ranked = [...judged].sort((a, b) => (b.score! - a.score!) || b.amount - a.amount);
  const best = ranked.find((e) => (e.score ?? 0) > 0) ?? null;
  const worst = [...judged].sort((a, b) => (a.score! - b.score!) || b.amount - a.amount).find((e) => (e.score ?? 0) < 0) ?? null;

  // ROI by category (expenses, in period).
  const catMap = new Map<string, { total: number; count: number; scoreSum: number; scored: number }>();
  for (const e of expInPeriod) {
    const c = catMap.get(e.category) ?? { total: 0, count: 0, scoreSum: 0, scored: 0 };
    c.total += e.amount;
    c.count++;
    if (e.score != null) {
      c.scoreSum += e.score;
      c.scored++;
    }
    catMap.set(e.category, c);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, c]) => ({ category, total: c.total, count: c.count, avgValue: c.scored ? c.scoreSum / c.scored : null }))
    .sort((a, b) => b.total - a.total);

  const investments = all.filter((e) => e.type === "investment");
  const investActive = investments.filter((e) => (e as MoneyEntry & { status?: string }).status !== "exited");
  // A monthly SIP accumulates every month — count each installment since it
  // started, not just one, so a ₹1,500/mo SIP running 2 months shows ₹3,000.
  const investedTotal = investActive.reduce(
    (s, e) => s + e.amount * installmentsElapsed(e.when, e.f.frequency || "one-time"),
    0,
  );

  const goals = all
    .filter((e) => e.type === "goal" && (e as MoneyEntry & { status?: string }).status !== "abandoned")
    .map((e) => {
      const target = e.amount;
      const current = parseAmount(e.f.current);
      return { id: e.id, title: e.title, target, current, pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0 };
    });

  const awaitingReview = all.filter(
    (e) => (e.type === "financial-decision" || e.type === "investment") && !e.f.reviewedAt && !e.f.reviewOutcome,
  ).length;

  return {
    period,
    spend: { total: spendTotal, count: expInPeriod.length },
    best,
    worst,
    byCategory,
    // Every individual spend in the period, newest first — for the full list view.
    allSpends: [...expInPeriod]
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        score: e.score,
        when: e.when,
        recurring: e.recurring,
      })),
    investments: { count: investActive.length, total: investedTotal },
    goals,
    awaitingReview,
  };
}
