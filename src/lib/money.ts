// Money OS analytics — the "wisdom" layer. Not accounting: every number here is
// in service of the question "did this spending create value?". Amounts and
// satisfaction live in the entry `fields` JSON and are parsed here.

import { prisma } from "@/lib/db";
import { parseFields } from "@/lib/utils";

const LOCALE = process.env.LATTICE_LOCALE || "en-IN";
const CURRENCY = process.env.LATTICE_CURRENCY || "INR";

export function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
}

export const MONEY_TYPES = ["financial-decision", "expense", "investment", "goal"];

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

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
const PERIOD_DAYS: Record<MoneyPeriod, number> = { month: 30, quarter: 91, year: 365, all: 100000 };

export async function moneyAnalytics(period: MoneyPeriod = "month") {
  const all = await moneyEntries();
  const since = Date.now() - PERIOD_DAYS[period] * 86_400_000;
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
  const investedTotal = investActive.reduce((s, e) => s + e.amount, 0);

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
    investments: { count: investActive.length, total: investedTotal },
    goals,
    awaitingReview,
  };
}
