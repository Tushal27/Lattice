import { CommitmentList } from "@/components/CommitmentList";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PageHeader } from "@/components/ui";
import { commitmentAnalytics, commitmentWeeklyReview, groupedCommitments } from "@/lib/commitments";

export const dynamic = "force-dynamic";

// Dates don't cross the RSC boundary cleanly into a client component's fetch
// refresh cycle, so serialize to the same JSON shape the API returns.
function serialize<T extends { dueDate: Date | null; completedAt: Date | null; createdAt: Date }>(c: T) {
  return {
    ...c,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  agent: "From chat",
  decision: "Decisions",
  lesson: "Lessons",
  question: "Questions",
  insight: "Insights",
};

export default async function CommitmentsPage() {
  const [groups, review, analytics] = await Promise.all([
    groupedCommitments(),
    commitmentWeeklyReview(),
    commitmentAnalytics(),
  ]);
  const maxWeek = Math.max(1, ...analytics.weeks);
  const sources = Object.entries(analytics.bySource).sort((a, b) => b[1].total - a[1].total);
  const initial = {
    overdue: groups.overdue.map(serialize),
    today: groups.today.map(serialize),
    upcoming: groups.upcoming.map(serialize),
    done: groups.done.map(serialize),
  };

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="🎯"
        accentColor="emerald"
        title="Commitments"
        subtitle="The follow-throughs your knowledge asks of you — reminders, reviews, and habits. Capture them by voice in the ✦ agent (“remind me to… next week”) or add one below."
      />
      <NotificationToggle />
      <CommitmentList initial={initial} review={review} />

      {(analytics.weeks.some((w) => w > 0) || sources.length > 0) && (
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Follow-through</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-zinc-500">Completed · last 6 weeks</p>
              <div className="flex h-24 items-end gap-2">
                {analytics.weeks.map((w, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400"
                      style={{ height: `${Math.max(4, (w / maxWeek) * 80)}px` }}
                      title={`${w} completed`}
                    />
                    <span className="text-[10px] text-zinc-600">{i === 5 ? "now" : `-${5 - i}w`}</span>
                  </div>
                ))}
              </div>
            </div>
            {sources.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-zinc-500">By source</p>
                <div className="space-y-2">
                  {sources.map(([key, v]) => (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-zinc-400">{SOURCE_LABEL[key] ?? key}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-emerald-500/70"
                          style={{ width: `${v.total ? (v.done / v.total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-zinc-500">
                        {v.done}/{v.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
