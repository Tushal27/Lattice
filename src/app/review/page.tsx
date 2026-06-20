import Link from "next/link";
import { EntryCard } from "@/components/EntryCard";
import { EmptyState, PageHeader, TypeBadge } from "@/components/ui";
import { decisionsAwaitingReview, onThisDay, resurface } from "@/lib/entries";
import { groupedCommitments } from "@/lib/commitments";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [toReview, resurfaced, history, commitments] = await Promise.all([
    decisionsAwaitingReview(),
    resurface(3),
    onThisDay(),
    groupedCommitments(),
  ]);

  const dueCommitments = [...commitments.overdue, ...commitments.today];
  const nothing =
    toReview.length === 0 &&
    resurfaced.length === 0 &&
    history.length === 0 &&
    dueCommitments.length === 0;

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-10">
      <PageHeader
        icon="☀️"
        accentColor="amber"
        title="Daily Review"
        subtitle="A few minutes with your past self — judge old calls, and let buried lessons resurface."
      />

      {nothing && (
        <EmptyState
          icon="☀️"
          title="Nothing to resurface yet"
          hint="As your entries age, this page brings the right ones back at the right time — old decisions to judge, buried lessons to revisit."
          action={
            <Link
              href="/capture"
              className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              ＋ Capture something
            </Link>
          }
        />
      )}

      {dueCommitments.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">🎯 Commitments due</h2>
          <p className="mb-4 text-sm text-zinc-500">Follow-throughs you set for yourself. Close the loop or snooze them.</p>
          <div className="space-y-2">
            {dueCommitments.map((c) => {
              const overdue = commitments.overdue.some((o) => o.id === c.id);
              return (
                <Link
                  key={c.id}
                  href="/commitments"
                  className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
                    overdue
                      ? "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40"
                      : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{c.title}</p>
                    <p className={`text-xs ${overdue ? "text-rose-200/70" : "text-emerald-200/70"}`}>
                      {overdue ? "overdue" : "due today"}
                      {c.recurringRule && ` · 🔁 ${c.recurringRule}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-medium ${overdue ? "text-rose-300" : "text-emerald-300"}`}>
                    Open →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {toReview.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">⏳ Decisions ready to judge</h2>
          <p className="mb-4 text-sm text-zinc-500">Enough time has passed. How did these turn out?</p>
          <div className="space-y-2">
            {toReview.map((d) => (
              <Link
                key={d.id}
                href={`/entry/${d.id}/edit`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-colors hover:border-amber-500/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{d.title}</p>
                  <p className="text-xs text-amber-200/70">
                    decided {relativeTime(d.createdAt)}
                    {d.confidence != null && ` · ${d.confidence}% confident`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-amber-300">Review →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {resurfaced.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">🌱 Worth remembering today</h2>
          <p className="mb-4 text-sm text-zinc-500">Lessons and insights brought back so they keep working for you.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resurfaced.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">📅 On this day</h2>
          <p className="mb-4 text-sm text-zinc-500">What you were thinking about on this date before.</p>
          <div className="space-y-2">
            {history.map((e) => (
              <Link
                key={e.id}
                href={`/entry/${e.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700"
              >
                <TypeBadge type={e.type} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{e.title}</span>
                <span className="shrink-0 text-xs text-zinc-500">{e.when.getFullYear()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-5">
        <p className="text-sm text-zinc-300">Want a deeper look back?</p>
        <Link href="/reflect" className="mt-1 inline-block text-sm font-medium text-violet-300 hover:underline">
          Generate a weekly reflection →
        </Link>
      </div>
    </div>
  );
}
