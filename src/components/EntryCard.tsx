import Link from "next/link";
import { TypeBadge } from "@/components/ui";
import { relativeTime, truncate } from "@/lib/utils";

export interface EntryCardData {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  status: string | null;
  confidence: number | null;
  createdAt: Date | string;
  tags?: { tag: { name: string } }[];
}

export function EntryCard({ entry }: { entry: EntryCardData }) {
  return (
    <Link
      href={`/entry/${entry.id}`}
      className="group block rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <TypeBadge type={entry.type} />
        <span className="text-[11px] text-zinc-500">{relativeTime(entry.createdAt)}</span>
      </div>
      <h3 className="font-medium text-zinc-100 group-hover:text-white">{entry.title}</h3>
      {entry.summary && <p className="mt-1 text-sm text-zinc-400">{truncate(entry.summary, 140)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        {entry.status && (
          <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-zinc-400">{entry.status}</span>
        )}
        {typeof entry.confidence === "number" && <span>confidence {entry.confidence}%</span>}
        {entry.tags && entry.tags.length > 0 && (
          <span className="text-zinc-500">{entry.tags.map((t) => `#${t.tag.name}`).join(" ")}</span>
        )}
      </div>
    </Link>
  );
}
