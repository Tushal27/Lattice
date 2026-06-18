import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { TYPE_LIST, TYPES } from "@/lib/types";
import { accent, cn, parseFields } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const [entries, connections] = await Promise.all([
    prisma.entry.findMany({
      select: {
        id: true,
        type: true,
        title: true,
        confidence: true,
        fields: true,
        createdAt: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    prisma.connection.findMany({ select: { fromId: true, toId: true } }),
  ]);

  if (entries.length === 0) {
    return (
      <div className="animate-[fadeUp_0.4s_ease-out]">
        <PageHeader icon="📊" accentColor="sky" title="Patterns" subtitle="How you think, seen from above." />
        <EmptyState icon="📊" title="Not enough data yet" hint="Patterns emerge once you've captured a handful of entries." />
      </div>
    );
  }

  // Area distribution
  const byType: Record<string, number> = {};
  for (const e of entries) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const maxType = Math.max(1, ...Object.values(byType));

  // Tag tallies (overall + last 30 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.getTime();
  const tagCount: Record<string, number> = {};
  const tagRecent: Record<string, number> = {};
  for (const e of entries) {
    const recent = e.createdAt.getTime() >= cutoff;
    for (const t of e.tags) {
      tagCount[t.tag.name] = (tagCount[t.tag.name] ?? 0) + 1;
      if (recent) tagRecent[t.tag.name] = (tagRecent[t.tag.name] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 18);
  const maxTag = Math.max(1, ...topTags.map(([, c]) => c));
  const emerging = Object.entries(tagRecent).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Decision calibration
  const decisions = entries.filter((e) => e.type === "decision");
  const reviewed = decisions
    .map((d) => ({ ...d, f: parseFields(d.fields) }))
    .filter((d) => d.f.reviewVerdict);
  const verdicts: Record<string, number> = {};
  for (const r of reviewed) verdicts[r.f.reviewVerdict] = (verdicts[r.f.reviewVerdict] ?? 0) + 1;
  const withConf = decisions.filter((d) => d.confidence != null);
  const avgConf = withConf.length
    ? Math.round(withConf.reduce((s, d) => s + (d.confidence ?? 0), 0) / withConf.length)
    : null;

  // Most connected
  const connCount: Record<string, number> = {};
  for (const c of connections) {
    connCount[c.fromId] = (connCount[c.fromId] ?? 0) + 1;
    connCount[c.toId] = (connCount[c.toId] ?? 0) + 1;
  }
  const titleMap = new Map(entries.map((e) => [e.id, e]));
  const mostConnected = Object.entries(connCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ entry: titleMap.get(id), count }))
    .filter((x) => x.entry);

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-6">
      <PageHeader icon="📊" accentColor="sky" title="Patterns" subtitle="How you think, learn, and decide — seen from above." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Area distribution */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Where your attention goes</h2>
          <div className="space-y-3">
            {TYPE_LIST.map((t) => {
              const count = byType[t.type] ?? 0;
              const a = accent(t.accent);
              return (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-zinc-300">
                    {t.icon} {t.plural}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div className={cn("h-full rounded-full", a.dot)} style={{ width: `${(count / maxType) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-sm tabular-nums text-zinc-400">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Decision calibration */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Decision calibration</h2>
          {decisions.length === 0 ? (
            <p className="text-sm text-zinc-500">No decisions logged yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-semibold text-zinc-50">{avgConf ?? "—"}%</div>
                  <div className="text-xs text-zinc-500">avg confidence</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-zinc-50">
                    {reviewed.length}/{decisions.length}
                  </div>
                  <div className="text-xs text-zinc-500">reviewed</div>
                </div>
              </div>
              {reviewed.length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(verdicts).map(([v, c]) => (
                    <div key={v} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{v}</span>
                      <span className="tabular-nums text-zinc-400">{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Review your decisions over time to see how well-calibrated your confidence is.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Recurring themes */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Recurring themes</h2>
          {topTags.length === 0 ? (
            <p className="text-sm text-zinc-500">Add tags to your entries to surface themes.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {topTags.map(([name, count]) => (
                <Link
                  key={name}
                  href={`/search?q=${encodeURIComponent(name)}`}
                  className="text-zinc-300 transition-colors hover:text-violet-300"
                  style={{ fontSize: `${0.8 + (count / maxTag) * 0.9}rem` }}
                >
                  #{name}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Emerging + most connected */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Emerging interests</h2>
          {emerging.length === 0 ? (
            <p className="mb-4 text-sm text-zinc-500">Nothing notable in the last 30 days.</p>
          ) : (
            <div className="mb-5 flex flex-wrap gap-1.5">
              {emerging.map(([name, count]) => (
                <span key={name} className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200">
                  #{name} <span className="text-sky-300/60">×{count}</span>
                </span>
              ))}
            </div>
          )}
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Most connected</h3>
          {mostConnected.length === 0 ? (
            <p className="text-sm text-zinc-500">Link entries to find your hubs of thinking.</p>
          ) : (
            <ul className="space-y-1.5">
              {mostConnected.map(({ entry, count }) => (
                <li key={entry!.id}>
                  <Link href={`/entry/${entry!.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-zinc-200">
                      {TYPES[entry!.type as keyof typeof TYPES]?.icon} {entry!.title}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">{count} links</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
