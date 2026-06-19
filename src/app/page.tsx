import Link from "next/link";
import { EntryCard } from "@/components/EntryCard";
import { OpenChatButton } from "@/components/OpenChatButton";
import { StatGrid } from "@/components/StatGrid";
import { decisionsAwaitingReview, getStats, listEntries } from "@/lib/entries";
import { prisma } from "@/lib/db";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Home() {
  const [stats, recent, awaitingReview, openQuestions] = await Promise.all([
    getStats(),
    listEntries({ limit: 6 }),
    decisionsAwaitingReview(),
    prisma.entry.findMany({
      where: { type: "question", status: "open" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true },
    }),
  ]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-10">
      {/* Hero */}
      <section className="ring-gradient relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-600/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-zinc-500">{today}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            <span className="text-gradient">{greeting()}.</span>
          </h1>
          <p className="mt-3 max-w-xl text-zinc-400">
            {stats.total === 0
              ? "This is your personal operating system. Capture a decision, a lesson, or a question — and watch your thinking compound over the years."
              : `You've captured ${stats.total} ${stats.total === 1 ? "moment" : "moments"} so far. Every one makes the next insight sharper.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/capture"
              className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              ＋ Capture something
            </Link>
            <Link
              href="/reflect"
              className="press rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
            >
              🔮 Reflect on your week
            </Link>
          </div>
        </div>
      </section>

      {/* Area stats */}
      <StatGrid counts={stats.byType} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Recent */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Recent</h2>
            <Link href="/timeline" className="text-sm text-zinc-500 hover:text-zinc-300">
              timeline →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
              <p className="text-zinc-400">Nothing captured yet.</p>
              <Link href="/capture" className="mt-2 inline-block text-sm font-medium text-violet-300 hover:underline">
                Capture your first entry →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recent.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>

        {/* Side rail: nudges */}
        <aside className="space-y-6">
          {awaitingReview.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-200">⏳ Time to review</h3>
              <p className="mb-3 text-xs text-amber-200/70">Decisions old enough to judge.</p>
              <ul className="space-y-2">
                {awaitingReview.slice(0, 4).map((d) => (
                  <li key={d.id}>
                    <Link href={`/entry/${d.id}`} className="block text-sm text-zinc-200 hover:text-white">
                      {d.title}
                      <span className="ml-1 text-xs text-zinc-500">· {relativeTime(d.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-200">❓ Open questions</h3>
            {openQuestions.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No open questions.{" "}
                <Link href="/capture?type=question" className="text-sky-300 hover:underline">
                  Capture one →
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {openQuestions.map((q) => (
                  <li key={q.id}>
                    <Link href={`/entry/${q.id}`} className="block text-sm text-zinc-200 hover:text-white">
                      {q.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-200">🧠 Thinking partner</h3>
            <p className="mb-3 text-xs text-violet-200/70">Find patterns and challenge your assumptions.</p>
            <OpenChatButton
              mode="wonder"
              className="press inline-block rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600"
            >
              Start a conversation →
            </OpenChatButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
