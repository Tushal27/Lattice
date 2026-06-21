import Link from "next/link";
import { MoneyGoals } from "@/components/money/MoneyGoals";
import { MoneyReflection } from "@/components/money/MoneyReflection";
import { QuickSpend } from "@/components/money/QuickSpend";
import { Card, EmptyState, PageHeader, TypeBadge } from "@/components/ui";
import { moneyAnalytics, formatMoney, type MoneyPeriod } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIODS: { id: MoneyPeriod; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

function valueTag(score: number | null) {
  if (score == null) return null;
  if (score >= 1) return { text: "worth it", cls: "text-emerald-300" };
  if (score <= -1) return { text: "regret", cls: "text-rose-300" };
  return { text: "mixed", cls: "text-amber-300" };
}

export default async function MoneyPage(props: PageProps<"/money">) {
  const sp = await props.searchParams;
  const period = (typeof sp.period === "string" ? sp.period : "month") as MoneyPeriod;
  const a = await moneyAnalytics(PERIODS.some((p) => p.id === period) ? period : "month");

  const empty =
    a.spend.count === 0 && !a.best && !a.worst && a.investments.count === 0 && a.goals.length === 0 && a.awaitingReview === 0;

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="💰"
        accentColor="amber"
        title="Money Review"
        subtitle="Not where your money went — whether it bought you a better life."
        action={
          <Link
            href="/capture?type=expense"
            className="press rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 hover:brightness-125"
          >
            ＋ Log spend
          </Link>
        }
      />

      {/* Fast logging */}
      <QuickSpend />

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={`/money?period=${p.id}`}
            className={cn(
              "press rounded-full border px-3 py-1.5 text-sm transition-colors",
              p.id === a.period
                ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {empty ? (
        <EmptyState
          icon="💰"
          title="No money entries yet"
          hint="Tell the ✦ agent “spent ₹2200 on Claude Code” or log a financial decision — then come back to see whether your spending is buying a better life."
          action={
            <Link
              href="/capture?type=financial-decision"
              className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              ＋ Capture a money decision
            </Link>
          }
        />
      ) : (
        <>
          {/* AI financial-judgment reflection */}
          <MoneyReflection period={a.period} />

          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Remembered spend" value={formatMoney(a.spend.total)} sub={`${a.spend.count} logged`} accent="text-rose-300" />
            <Stat label="Invested (active)" value={formatMoney(a.investments.total)} sub={`${a.investments.count} holdings`} accent="text-emerald-300" />
            <Stat label="Goals" value={String(a.goals.length)} sub="in progress" accent="text-cyan-300" />
            <Link href="/review" className="block">
              <Stat label="Awaiting review" value={String(a.awaitingReview)} sub="ready to judge →" accent="text-amber-300" />
            </Link>
          </div>

          {/* Best vs most regretted */}
          {(a.best || a.worst) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Highlight title="Best money this period" entry={a.best} tone="emerald" />
              <Highlight title="Most regretted" entry={a.worst} tone="rose" />
            </div>
          )}

          {/* ROI by category */}
          {a.byCategory.length > 0 && (
            <Card>
              <h2 className="section-label mb-4">Where the money went — and whether it was worth it</h2>
              <div className="space-y-3">
                {a.byCategory.map((c) => {
                  const v = valueTag(c.avgValue);
                  return (
                    <div key={c.category} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate text-zinc-300">{c.category}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-rose-500/70"
                          style={{ width: `${a.byCategory[0].total ? (c.total / a.byCategory[0].total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="tabnums w-20 shrink-0 text-right text-zinc-400">{formatMoney(c.total)}</span>
                      <span className={cn("w-16 shrink-0 text-right text-xs", v?.cls ?? "text-zinc-600")}>
                        {v?.text ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Goals — with one-tap contributions */}
          {a.goals.length > 0 && <MoneyGoals goals={a.goals} />}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="elev rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className={cn("tabnums text-xl font-semibold", accent)}>{value}</div>
      <div className="mt-1 text-xs text-zinc-300">{label}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function Highlight({
  title,
  entry,
  tone,
}: {
  title: string;
  entry: { id: string; type: string; title: string; amount: number; score: number | null } | null;
  tone: "emerald" | "rose";
}) {
  const border = tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5";
  if (!entry) {
    return (
      <div className={cn("elev rounded-2xl border p-4", border)}>
        <h3 className="section-label mb-2">{title}</h3>
        <p className="text-sm text-zinc-500">Nothing judged yet — review a few to see this.</p>
      </div>
    );
  }
  return (
    <Link href={`/entry/${entry.id}`} className={cn("elev lift block rounded-2xl border p-4", border)}>
      <h3 className="section-label mb-2">{title}</h3>
      <div className="mb-1 flex items-center gap-2">
        <TypeBadge type={entry.type} size="xs" />
        <span className="tabnums text-xs text-zinc-500">{formatMoney(entry.amount)}</span>
      </div>
      <p className="font-medium text-zinc-100">{entry.title}</p>
    </Link>
  );
}
