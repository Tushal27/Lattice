// Pure, client-safe money formatting/parsing — no DB imports, so it can be used
// from client components without dragging server-only code into the bundle.

const LOCALE = process.env.NEXT_PUBLIC_LATTICE_LOCALE || process.env.LATTICE_LOCALE || "en-IN";
const CURRENCY = process.env.NEXT_PUBLIC_LATTICE_CURRENCY || process.env.LATTICE_CURRENCY || "INR";

export function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
}

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface GoalProjection {
  hasDeadline: boolean;
  monthly: number;
  annualReturnPct: number;
  monthsLeft: number;
  projectedValue: number; // future value at the deadline
  onTrackPct: number; // projectedValue / target
  requiredMonthly: number; // monthly contribution needed to exactly hit target
  shortfall: number; // target - projectedValue (negative = surplus)
  status: "ahead" | "on-track" | "behind" | "unknown";
}

/**
 * Compound-growth projection for a financial goal: will current savings + the
 * monthly contribution, growing at an assumed annual return, reach the target by
 * the deadline? Pure math — no AI, no DB — so it runs anywhere instantly.
 */
export function projectGoal(opts: {
  target: number;
  current: number;
  monthly: number;
  annualReturnPct: number;
  deadline: string | null;
  now?: Date;
}): GoalProjection {
  const { target, current, monthly, annualReturnPct } = opts;
  const now = opts.now ?? new Date();
  const hasDeadline = Boolean(opts.deadline);
  const monthsLeft = opts.deadline
    ? Math.max(0, Math.round((new Date(opts.deadline).getTime() - now.getTime()) / (30.4375 * 86_400_000)))
    : 0;

  const r = annualReturnPct / 100 / 12; // monthly rate
  const n = monthsLeft;
  const growth = r > 0 ? Math.pow(1 + r, n) : 1;
  const fvCurrent = current * growth;
  const fvSip = r > 0 ? monthly * ((growth - 1) / r) : monthly * n;
  const projectedValue = fvCurrent + fvSip;

  const onTrackPct = target > 0 ? (projectedValue / target) * 100 : 0;
  let requiredMonthly = 0;
  if (n > 0) {
    requiredMonthly = r > 0 ? ((target - fvCurrent) * r) / (growth - 1) : (target - current) / n;
    if (requiredMonthly < 0) requiredMonthly = 0;
  }

  let status: GoalProjection["status"] = "unknown";
  if (hasDeadline && (monthly > 0 || current > 0) && target > 0) {
    status = projectedValue >= target * 1.02 ? "ahead" : projectedValue >= target * 0.95 ? "on-track" : "behind";
  }

  return {
    hasDeadline,
    monthly,
    annualReturnPct,
    monthsLeft: n,
    projectedValue,
    onTrackPct,
    requiredMonthly,
    shortfall: target - projectedValue,
    status,
  };
}
