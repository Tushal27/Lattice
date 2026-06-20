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

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/embeddings/test");
      setRes(await r.json());
    } catch {
      setRes({ enabled: true, ok: false });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Runs once on mount; state updates happen asynchronously after the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
  }, [check]);

  const base = "rounded-2xl border p-4 text-sm";

  if (!res) {
    return <div className={`${base} border-zinc-800/80 bg-zinc-900/40 text-zinc-500`}>🧠 Checking semantic memory…</div>;
  }

  if (!res.enabled) {
    return (
      <div className={`${base} border-zinc-800/80 bg-zinc-900/40 text-zinc-400`}>
        🧠 Semantic memory is off. Set <code className="rounded bg-white/10 px-1 text-zinc-200">EMBEDDINGS_MODEL</code>{" "}
        (try <code className="rounded bg-white/10 px-1 text-zinc-200">text-embedding-3-small</code>) to make
        MistakeWarning match by meaning. Until then it matches by tags &amp; words.
      </div>
    );
  }

  if (res.ok) {
    return (
      <div className={`${base} flex items-center justify-between gap-3 border-emerald-500/20 bg-emerald-500/5`}>
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
