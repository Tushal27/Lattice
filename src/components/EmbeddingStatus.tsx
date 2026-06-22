"use client";

import { useCallback, useEffect, useState } from "react";

interface Result {
  enabled: boolean;
  ok?: boolean;
  model?: string | null;
  dimensions?: number;
}

export function EmbeddingStatus() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<number | null>(null);
  const [embedding, setEmbedding] = useState(false);

  const loadMissing = useCallback(async () => {
    try {
      const r = await fetch("/api/embeddings/backfill");
      const d = await r.json();
      setMissing(d.enabled ? (d.missing ?? 0) : null);
    } catch {
      setMissing(null);
    }
  }, []);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/embeddings/test");
      const data = await r.json();
      setRes(data);
      if (data?.ok) loadMissing();
    } catch {
      setRes({ enabled: true, ok: false });
    } finally {
      setBusy(false);
    }
  }, [loadMissing]);

  useEffect(() => {
    // Runs once on mount; state updates happen asynchronously after the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
  }, [check]);

  async function backfill() {
    if (embedding) return;
    setEmbedding(true);
    try {
      // Loop until nothing remains (each call embeds a bounded batch).
      for (let i = 0; i < 50; i++) {
        const r = await fetch("/api/embeddings/backfill", { method: "POST" });
        const d = await r.json();
        setMissing(d.remaining ?? 0);
        if (!d.enabled || (d.remaining ?? 0) <= 0 || (d.embedded ?? 0) === 0) break;
      }
    } catch {
      /* leave missing as-is */
    } finally {
      setEmbedding(false);
    }
  }

  const base = "rounded-2xl border p-4 text-sm";

  if (!res) {
    return <div className={`${base} border-zinc-800/80 bg-zinc-900/40 text-zinc-500`}>🧠 Checking semantic memory…</div>;
  }

  if (!res.enabled) {
    return (
      <div className={`${base} border-zinc-800/80 bg-zinc-900/40 text-zinc-400`}>
        🧠 Semantic memory is off. Set <code className="rounded bg-white/10 px-1 text-zinc-200">EMBEDDINGS_MODEL</code>{" "}
        (e.g. <code className="rounded bg-white/10 px-1 text-zinc-200">text-embedding-004</code>) to make connections and
        MistakeWarning match by meaning. Until then it matches by tags &amp; words.
      </div>
    );
  }

  if (res.ok) {
    return (
      <div className={`${base} border-emerald-500/20 bg-emerald-500/5`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-200">
            🧠 Semantic memory active{" "}
            <span className="text-zinc-500">
              · {res.model} · {res.dimensions}d
            </span>
          </span>
          <button onClick={check} disabled={busy} className="press rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10">
            Re-test
          </button>
        </div>
        {missing != null && missing > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span className="text-xs text-zinc-400">
              {embedding ? `Embedding… ${missing} left` : `${missing} older entries aren't embedded yet`}
            </span>
            <button
              onClick={backfill}
              disabled={embedding}
              className="press rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {embedding ? "Embedding…" : "Embed them now"}
            </button>
          </div>
        )}
        {missing === 0 && (
          <div className="mt-3 border-t border-white/10 pt-3 text-xs text-emerald-300/80">✓ All entries embedded</div>
        )}
      </div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-between gap-3 border-amber-500/20 bg-amber-500/5`}>
      <span className="text-amber-200/90">
        🧠 Couldn&apos;t get embeddings for{" "}
        <code className="rounded bg-white/10 px-1 text-amber-100">{res.model}</code>. Try a different
        <code className="ml-1 rounded bg-white/10 px-1 text-amber-100">EMBEDDINGS_MODEL</code> name your roster serves.
      </span>
      <button onClick={check} disabled={busy} className="press rounded-lg px-3 py-1.5 text-xs text-amber-200 hover:bg-white/10">
        Re-test
      </button>
    </div>
  );
}
