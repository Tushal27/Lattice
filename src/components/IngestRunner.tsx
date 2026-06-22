"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Same-origin capture target for the bookmarklet: it opens /ingest?url=… and
// this runs the ingestion (no CORS, no extension needed).
export function IngestRunner({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "skipped" | "error">(url ? "working" : "idle");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ingest/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? "Couldn't capture that link.");
          setState("error");
          return;
        }
        setTitle(data.title ?? url);
        setState(data.skipped ? "skipped" : "done");
      } catch {
        if (!cancelled) {
          setError("Network error.");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 text-3xl">
        {state === "error" ? "⚠️" : state === "working" ? "📥" : "✓"}
      </div>
      {state === "idle" && (
        <p className="text-zinc-400">Open this with a <code className="rounded bg-white/10 px-1">?url=</code> to capture a link.</p>
      )}
      {state === "working" && <p className="text-zinc-300">Capturing &amp; distilling…</p>}
      {(state === "done" || state === "skipped") && (
        <>
          <h1 className="text-lg font-semibold text-zinc-100">{state === "skipped" ? "Already captured" : "Saved to Lattice"}</h1>
          <p className="mt-1 text-sm text-zinc-400">{title}</p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="text-lg font-semibold text-zinc-100">Couldn&apos;t capture</h1>
          <p className="mt-1 text-sm text-zinc-400">{error}</p>
        </>
      )}
      <Link href="/" className="press mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
        Open Lattice →
      </Link>
    </div>
  );
}
