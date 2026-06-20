import Link from "next/link";
import { EmptyState, PageHeader, TypeBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { TYPES } from "@/lib/types";
import { accent, cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const entries = await prisma.entry.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, type: true, title: true, summary: true, occurredAt: true, createdAt: true },
  });

  const dated = entries
    .map((e) => ({ ...e, when: e.occurredAt ?? e.createdAt }))
    .sort((a, b) => b.when.getTime() - a.when.getTime());

  const groups = new Map<string, typeof dated>();
  for (const e of dated) {
    const key = e.when.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader icon="🧭" accentColor="violet" title="Life Timeline" subtitle="Look back and watch yourself evolve." />

      {dated.length === 0 ? (
        <EmptyState
          icon="🧭"
          title="Your timeline is empty"
          hint="Capture moments and they'll appear here in order — your story, building over time."
          action={
            <Link
              href="/capture"
              className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              ＋ Capture something
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {[...groups.entries()].map(([month, items]) => (
            <div key={month}>
              <h2 className="section-label mb-4">{month}</h2>
              <div className="relative space-y-4 border-l border-white/10 pl-6">
                {items.map((e) => {
                  const a = accent(TYPES[e.type]?.accent ?? "violet");
                  return (
                    <div key={e.id} className="relative">
                      <span className={cn("absolute -left-[27px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-[#07070a]", a.dot)} />
                      <Link
                        href={`/entry/${e.id}`}
                        className="elev lift block rounded-xl border border-white/8 bg-white/[0.03] p-4 focus-ring hover:border-white/15"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <TypeBadge type={e.type} size="xs" />
                          <span className="tabnums text-[11px] text-zinc-500">{formatDate(e.when)}</span>
                        </div>
                        <p className="font-medium text-zinc-100">{e.title}</p>
                        {e.summary && <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{e.summary}</p>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
