"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}: {
  entryId: string;
  existing: ExistingConnection[];
  suggestions: RelatedEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightSource, setInsightSource] = useState<"ai" | "local" | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  async function link(toId: string) {
    setBusy(toId);
    await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId: entryId, toId }),
    });
    setBusy(null);
    router.refresh();
  }

  async function unlink(connectionId: string) {
    setBusy(connectionId);
    await fetch(`/api/connections?id=${connectionId}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
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
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Connections</h3>
        {existing.length === 0 ? (
          <p className="text-sm text-zinc-500">No connections yet. Link this to related ideas below.</p>
        ) : (
          <ul className="space-y-2">
            {existing.map((c) => (
              <li
                key={c.connectionId}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <Link href={`/entry/${c.id}`} className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TypeBadge type={c.type} size="xs" />
                  </div>
                  <p className="truncate text-sm text-zinc-200">{c.title}</p>
                </Link>
                <button
                  onClick={() => unlink(c.connectionId)}
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

      {suggestions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">You might connect…</h3>
            <button
              onClick={askInsight}
              disabled={loadingInsight}
              className="rounded-full bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loadingInsight ? "Thinking…" : "✦ Ask AI why"}
            </button>
          </div>

          {insight && (
            <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-zinc-200">
              <Markdown>{insight}</Markdown>
              {insightSource === "local" && (
                <p className="mt-2 text-xs text-zinc-500">Set GEMINI_API_KEY for AI-written insight.</p>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3"
              >
                <Link href={`/entry/${s.id}`} className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TypeBadge type={s.type} size="xs" />
                  </div>
                  <p className="truncate text-sm text-zinc-300">{s.title}</p>
                </Link>
                <button
                  onClick={() => link(s.id)}
                  disabled={busy === s.id}
                  className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-violet-300 disabled:opacity-50"
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
