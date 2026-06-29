"use client";

import { useState } from "react";
import { EntryCard, type EntryCardData } from "@/components/EntryCard";
import { toast } from "@/components/Toast";

// Appends pages of entries below the server-rendered first page, so an area
// with hundreds of entries doesn't render (or fetch) them all up front.
export function LoadMoreEntries({
  type,
  pageSize,
  initialOffset,
  total,
}: {
  type: string;
  pageSize: number;
  initialOffset: number;
  total: number;
}) {
  const [extra, setExtra] = useState<EntryCardData[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [busy, setBusy] = useState(false);

  const loaded = initialOffset + extra.length;
  const remaining = total - loaded;
  if (remaining <= 0) return null;

  async function loadMore() {
    setBusy(true);
    try {
      const res = await fetch(`/api/entries?type=${encodeURIComponent(type)}&limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error();
      const rows = (await res.json()) as EntryCardData[];
      setExtra((prev) => [...prev, ...rows]);
      setOffset((o) => o + rows.length);
    } catch {
      toast("Couldn't load more", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {extra.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {extra.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-center">
        <button
          onClick={loadMore}
          disabled={busy}
          className="press rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? "Loading…" : `Show more (${remaining} left)`}
        </button>
      </div>
    </>
  );
}
