import Link from "next/link";
import { EntryCard } from "@/components/EntryCard";
import { EmptyState, PageHeader } from "@/components/ui";
import { listEntries } from "@/lib/entries";
import { TYPES, type EntryType } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

export async function AreaView({ type }: { type: EntryType }) {
  const cfg = TYPES[type];
  const a = accent(cfg.accent);
  const entries = await listEntries({ type });

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon={cfg.icon}
        accentColor={cfg.accent}
        title={cfg.plural}
        subtitle={cfg.tagline}
        action={
          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <span className="tabnums rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                {entries.length}
              </span>
            )}
            <Link
              href={`/capture?type=${type}`}
              className={cn(
                "press rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:brightness-125",
                a.bg,
                a.border,
                a.text,
              )}
            >
              ＋ New {cfg.label}
            </Link>
          </div>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.plural.toLowerCase()} yet`}
          hint={cfg.intro}
          action={
            <Link
              href={`/capture?type=${type}`}
              className={cn("press rounded-xl border px-4 py-2.5 text-sm font-medium hover:brightness-125", a.bg, a.border, a.text)}
            >
              ＋ New {cfg.label}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
