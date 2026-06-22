import { Suspense } from "react";
import Link from "next/link";
import { DailyBrief } from "@/components/DailyBrief";
import { InsightFeed } from "@/components/InsightFeed";
import { InsightRefresher } from "@/components/InsightRefresher";
import { ModuleScopeProvider, ModuleSwitcher } from "@/components/ModuleSwitcher";
import { MoneyWidget } from "@/components/MoneyWidget";
import { OpenChatButton } from "@/components/OpenChatButton";
import { RecentEntries } from "@/components/RecentEntries";
import { Skeleton } from "@/components/Skeleton";
import { StatGrid } from "@/components/StatGrid";
import { decisionsAwaitingReview, getStats, listEntries } from "@/lib/entries";
import { groupedCommitments } from "@/lib/commitments";
import { moneyAnalytics } from "@/lib/money";
import { activeInsights, type InsightRow } from "@/lib/insights";
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

// The page itself is synchronous: the shell (hero + switcher) paints instantly,
// and each data-bearing section streams in independently via Suspense — so the
// app never blocks on the slowest query. Insights are READ here (cheap); the
// recompute runs in the background (InsightRefresher), off the render path.
export default function Home() {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <ModuleScopeProvider>
      <div className="animate-[fadeUp_0.4s_ease-out] space-y-10">
        {/* Hero — static, instant */}
        <section className="ring-gradient elev relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-600/15 blur-3xl" />
          <div className="relative">
            <p className="text-sm text-zinc-500">{today}</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight">
              <span className="text-gradient">{greeting()}.</span>
            </h1>
            <p className="mt-3 max-w-xl text-zinc-400">
              Your personal operating system. Capture a decision, a lesson, or a question — and watch your thinking
              compound over the years.
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

        <ModuleSwitcher />

        <DailyBrief />

        <Suspense fallback={<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{skeletons(5, "h-28 rounded-2xl")}</div>}>
          <DashboardStats />
        </Suspense>

        <Suspense fallback={null}>
          <DashboardInsights />
        </Suspense>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Suspense fallback={<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{skeletons(4, "h-32 rounded-2xl")}</div>}>
            <DashboardRecent />
          </Suspense>
          <Suspense fallback={<aside className="space-y-6">{skeletons(3, "h-28 rounded-2xl")}</aside>}>
            <DashboardSideRail />
          </Suspense>
        </div>
      </div>

      {/* Background recompute, off the render path */}
      <InsightRefresher />
    </ModuleScopeProvider>
  );
}

function skeletons(n: number, cls: string) {
  return Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={cls} />);
}

async function DashboardStats() {
  const stats = await getStats();
  return <StatGrid counts={stats.byType} />;
}

async function DashboardInsights() {
  const insights = await activeInsights();
  const items = insights.map((i: InsightRow) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    body: i.body,
    entityId: i.entityId,
  }));
  return <InsightFeed initial={items} />;
}

async function DashboardRecent() {
  const recentAll = await listEntries({ limit: 30 });
  const recent = recentAll.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    summary: e.summary,
    status: e.status,
    confidence: e.confidence,
    createdAt: e.createdAt,
    tags: e.tags?.map((t) => ({ tag: { name: t.tag.name } })),
  }));
  return <RecentEntries entries={recent} />;
}

async function DashboardSideRail() {
  const [commitments, awaitingReview, openQuestions, money] = await Promise.all([
    groupedCommitments(),
    decisionsAwaitingReview(),
    prisma.entry.findMany({
      where: { type: "question", status: "open" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true },
    }),
    moneyAnalytics("month"),
  ]);

  const dueNow = [...commitments.overdue, ...commitments.today];
  const moneyWidget = {
    spendTotal: money.spend.total,
    spendCount: money.spend.count,
    worst: money.worst ? { id: money.worst.id, title: money.worst.title, amount: money.worst.amount } : null,
  };

  return (
    <aside className="space-y-6">
      <MoneyWidget data={moneyWidget} />

      {dueNow.length > 0 && (
        <div className="elev rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-emerald-200">
            <span className="flex items-center gap-2">🎯 Commitments</span>
            {commitments.overdue.length > 0 && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-300">
                {commitments.overdue.length} overdue
              </span>
            )}
          </h3>
          <p className="mb-3 text-xs text-emerald-200/70">Your follow-throughs for today.</p>
          <ul className="space-y-2">
            {dueNow.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="text-sm text-zinc-200">{c.title}</span>
              </li>
            ))}
          </ul>
          <Link href="/commitments" className="mt-3 inline-block text-xs font-medium text-emerald-300 hover:underline">
            View all →
          </Link>
        </div>
      )}

      {awaitingReview.length > 0 && (
        <div className="elev rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
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

      <div className="elev rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
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

      <div className="elev rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-4">
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
  );
}
