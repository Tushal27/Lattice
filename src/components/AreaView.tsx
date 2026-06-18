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
          <Link
            href={`/capture?type=${type}`}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              a.bg,
              a.border,
              a.text,
              "hover:brightness-125",
            )}
          >
            ＋ New {cfg.label}
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.plural.toLowerCase()} yet`}
          hint={cfg.intro}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
