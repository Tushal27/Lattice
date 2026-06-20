import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectionPanel, type ExistingConnection } from "@/components/entry/ConnectionPanel";
import { EntryToolbar } from "@/components/entry/EntryToolbar";
import { Card, TagChip, TypeBadge } from "@/components/ui";
import { entryToFormValues, getEntry, suggestConnections } from "@/lib/entries";
import { configFor } from "@/lib/types";
import { accent, cn, formatDate, parseFields, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function verdictStyle(v: string): string {
  switch (v) {
    case "Right call":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "Wrong call":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    case "Mixed":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-zinc-700 bg-zinc-800/60 text-zinc-300";
  }
}

export default async function EntryPage(props: PageProps<"/entry/[id]">) {
  const { id } = await props.params;
  const entry = await getEntry(id);
  if (!entry) notFound();

  const cfg = configFor(entry.type);
  if (!cfg) notFound();
  const a = accent(cfg.accent);

  const values = entryToFormValues(entry, entry.type);
  const reviewFields = cfg.fields.filter((f) => f.review && values[f.key]);
  const reviewed = entry.type === "decision" && reviewFields.length > 0;
  const reviewedAt = parseFields(entry.fields).reviewedAt;
  // Column-backed values (status, confidence, dates) already appear in the meta
  // row, so the body shows only the rich, written-out fields. When a decision
  // has been reviewed, `expected` moves into the Expected-vs-Actual block.
  const contentFields = cfg.fields.filter(
    (f) => !f.column && !f.review && values[f.key] && !(reviewed && f.key === "expected"),
  );
  const needsReview =
    entry.type === "decision" && reviewFields.length === 0 && !parseFields(entry.fields).reviewOutcome;

  const existing: ExistingConnection[] = [
    ...entry.connectionsFrom.map((c) => ({
      connectionId: c.id,
      note: c.note,
      id: c.to.id,
      type: c.to.type,
      title: c.to.title,
      summary: c.to.summary,
    })),
    ...entry.connectionsTo.map((c) => ({
      connectionId: c.id,
      note: c.note,
      id: c.from.id,
      type: c.from.type,
      title: c.from.title,
      summary: c.from.summary,
    })),
  ];

  const suggestions = await suggestConnections(entry.id, 5);

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <Link
        href={`/area/${cfg.slug}`}
        className="group mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">←</span> {cfg.plural}
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* Premium hero */}
          <div className="ring-gradient elev relative mb-6 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] p-6">
            <div className={cn("pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl", a.dot)} />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={cn(
                      "hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl sm:grid",
                      a.bg,
                      a.border,
                    )}
                  >
                    {cfg.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <TypeBadge type={entry.type} />
                      <span className="tabnums text-xs text-zinc-500">added {relativeTime(entry.createdAt)}</span>
                    </div>
                    <h1 className="break-words text-3xl font-semibold leading-[1.1] text-zinc-50">{entry.title}</h1>
                    {entry.summary && (
                      <p className="mt-2 break-words text-[15px] leading-relaxed text-zinc-400">{entry.summary}</p>
                    )}
                  </div>
                </div>
                <EntryToolbar id={entry.id} />
              </div>

              {(entry.confidence != null || entry.status || entry.occurredAt || entry.project) && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {entry.confidence != null && (
                    <span className={cn("tabnums rounded-full px-2.5 py-1 text-xs font-medium", a.bg, a.text)}>
                      confidence {entry.confidence}%
                    </span>
                  )}
                  {entry.status && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300">{entry.status}</span>
                  )}
                  {entry.occurredAt && (
                    <span className="tabnums rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
                      📅 {formatDate(entry.occurredAt)}
                    </span>
                  )}
                  {entry.project && (
                    <Link
                      href={`/entry/${entry.project.id}`}
                      className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300 transition-colors hover:bg-violet-500/20"
                    >
                      🚀 {entry.project.title}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {entry.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {entry.tags.map((t) => (
                <TagChip key={t.tag.name} name={t.tag.name} />
              ))}
            </div>
          )}

          {needsReview && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-200">
                ⏳ This decision is ready to be reviewed. How did it turn out?
              </p>
              <Link
                href={`/entry/${entry.id}/edit`}
                className="mt-2 inline-block text-sm font-medium text-amber-300 hover:underline"
              >
                Add your review →
              </Link>
            </div>
          )}

          {contentFields.length > 0 && (
            <div className="space-y-3">
              {contentFields.map((f) => (
                <div key={f.key} className={cn("rounded-r-xl border-l-2 bg-white/[0.02] py-3 pl-4 pr-4", a.border)}>
                  <div className="section-label mb-1.5">{f.label}</div>
                  <p className="whitespace-pre-line [overflow-wrap:anywhere] leading-relaxed text-zinc-200">
                    {values[f.key]}
                  </p>
                </div>
              ))}
            </div>
          )}

          {reviewed && (
            <Card className="mt-6 border-amber-500/20 bg-amber-500/5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-amber-200">Review</h3>
                {reviewedAt && (
                  <span className="text-xs text-amber-200/60">reviewed {relativeTime(reviewedAt)}</span>
                )}
              </div>

              {/* Verdict + would-repeat badges */}
              {(values.reviewVerdict || values.wouldRepeat) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {values.reviewVerdict && (
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", verdictStyle(values.reviewVerdict))}>
                      {values.reviewVerdict}
                    </span>
                  )}
                  {values.wouldRepeat && (
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300">
                      Repeat? {values.wouldRepeat}
                    </span>
                  )}
                </div>
              )}

              {/* Expected vs Actual */}
              {(values.expected || values.reviewOutcome) && (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Expected</h4>
                    <p className="whitespace-pre-line [overflow-wrap:anywhere] text-sm text-zinc-300">{values.expected || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/70">What actually happened</h4>
                    <p className="whitespace-pre-line [overflow-wrap:anywhere] text-sm text-zinc-200">{values.reviewOutcome || "—"}</p>
                  </div>
                </div>
              )}

              {values.reviewLearning && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/70">
                    What you&apos;d do differently
                  </h4>
                  <p className="whitespace-pre-line [overflow-wrap:anywhere] text-zinc-200">{values.reviewLearning}</p>
                </div>
              )}
            </Card>
          )}

          {entry.children.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">In this project</h3>
              <ul className="space-y-2">
                {entry.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/entry/${child.id}`}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700"
                    >
                      <TypeBadge type={child.type} size="xs" />
                      <span className="truncate text-sm text-zinc-200">{child.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:border-l lg:border-zinc-800/80 lg:pl-8">
          <ConnectionPanel entryId={entry.id} existing={existing} suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
