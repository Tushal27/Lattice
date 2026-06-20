"use client";

import Link from "next/link";
import { EntryCard, type EntryCardData } from "@/components/EntryCard";
import { moduleTypeKeys, useModuleScope } from "@/components/ModuleSwitcher";
import { moduleById } from "@/lib/types";

// Recent list, scoped instantly to the active module (client-side filter).
export function RecentEntries({ entries }: { entries: EntryCardData[] }) {
  const { active } = useModuleScope();
  const scoped = active !== "all";
  const keys = moduleTypeKeys(active);
  const list = (scoped ? entries.filter((e) => keys.has(e.type)) : entries).slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          Recent{scoped ? ` · ${moduleById(active)?.name ?? ""}` : ""}
        </h2>
        <Link href="/timeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          timeline →
        </Link>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <p className="text-zinc-400">{scoped ? "Nothing in this module yet." : "Nothing captured yet."}</p>
          <Link href="/capture" className="mt-2 inline-block text-sm font-medium text-violet-300 hover:underline">
            Capture {scoped ? "something here" : "your first entry"} →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
