"use client";

import { useState } from "react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { TypeBadge } from "@/components/ui";

export interface RelatedEntry {
  id: string;
  type: string;
  title: string;
  summary: string | null;
}

export interface ExistingConnection extends RelatedEntry {
  connectionId: string;
  note: string | null;
}

export function ConnectionPanel({
  entryId,
  existing,
  suggestions,
  suggestionsLoading = false,
}: {
  entryId: string;
  existing: ExistingConnection[];
  suggestions: RelatedEntry[];
  suggestionsLoading?: boolean;
}) {
  // Local, optimistic state so link/unlink feel instant — no full page refresh.
  const [existingList, setExistingList] = useState(existing);
  const [suggestList, setSuggestList] = useState(suggestions);
  const [busy, setBusy] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightSource, setInsightSource] = useState<"ai" | "local" | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  async function link(s: RelatedEntry) {
    setBusy(s.id);
    const tempId = `pending-${s.id}`;
    setSuggestList((prev) => prev.filter((x) => x.id !== s.id));
    setExistingList((prev) => [{ connectionId: tempId, note: null, ...s }, ...prev]);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: entryId, toId: s.id }),
      });
      const conn = await res.json();
      setExistingList((prev) =>
        prev.map((x) => (x.connectionId === tempId ? { ...x, connectionId: conn.id ?? tempId } : x)),
      );
    } catch {
      // revert
      setExistingList((prev) => prev.filter((x) => x.connectionId !== tempId));
      setSuggestList((prev) => [s, ...prev]);
    } finally {
      setBusy(null);
    }
  }

  async function unlink(c: ExistingConnection) {
    setBusy(c.connectionId);
    setExistingList((prev) => prev.filter((x) => x.connectionId !== c.connectionId));
    try {
      await fetch(`/api/connections?id=${c.connectionId}`, { method: "DELETE" });
    } catch {
      setExistingList((prev) => [c, ...prev]);
    } finally {
      setBusy(null);
    }
  }

  async function askInsight() {
    setLoadingInsight(true);
    setInsight(null);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "connect", entryId }),
    });
    const data = await res.json();
    setInsight(data.text);
    setInsightSource(data.source);
    setLoadingInsight(false);
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="section-label mb-3">Connections</h3>
        {existingList.length === 0 ? (
          <p className="text-sm text-zinc-500">No connections yet. Link this to related ideas below.</p>
        ) : (
          <ul className="space-y-2">
            {existingList.map((c) => (
              <li
                key={c.connectionId}
                className="elev lift flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 hover:border-white/15"
              >
                <Link href={`/entry/${c.id}`} className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TypeBadge type={c.type} size="xs" />
                  </div>
                  <p className="truncate text-sm text-zinc-200">{c.title}</p>
                </Link>
                <button
                  onClick={() => unlink(c)}
                  disabled={busy === c.connectionId}
                  className="shrink-0 text-xs text-zinc-500 transition-colors hover:text-rose-400 disabled:opacity-50"
                >
                  unlink
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suggestionsLoading && (
        <section>
          <h3 className="section-label mb-3">You might connect…</h3>
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            Finding related ideas…
          </p>
        </section>
      )}

      {suggestList.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-label">You might connect…</h3>
            <button
              onClick={askInsight}
              disabled={loadingInsight}
              className="press rounded-full bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loadingInsight ? "Thinking…" : "✦ Ask AI why"}
            </button>
          </div>

          {insight && (
            <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-zinc-200">
              <Markdown>{insight}</Markdown>
              {insightSource === "local" && (
                <p className="mt-2 text-xs text-zinc-500">Add an AI key for AI-written insight.</p>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {suggestList.map((s) => (
              <li
                key={s.id}
                className="elev lift flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 hover:border-white/15"
              >
                <Link href={`/entry/${s.id}`} className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TypeBadge type={s.type} size="xs" />
                  </div>
                  <p className="truncate text-sm text-zinc-300">{s.title}</p>
                </Link>
                <button
                  onClick={() => link(s)}
                  disabled={busy === s.id}
                  className="press shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-violet-300 disabled:opacity-50"
                >
                  + link
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
