"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

export function JudgmentCard() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setText(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "judgment" }),
      });
      const data = await res.json();
      setText(data.text);
    } catch {
      setText("Couldn't analyze right now — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-200">AI judgment analysis</h2>
          <p className="mt-0.5 text-xs text-violet-200/60">How calibrated are you? What separates your good calls from bad?</p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="press shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? "Analyzing…" : text ? "↻ Re-run" : "✦ Analyze"}
        </button>
      </div>
      {loading && (
        <div className="space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-full animate-pulse rounded bg-zinc-800/70" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800/70" />
        </div>
      )}
      {text && !loading && (
        <div className="text-sm text-zinc-200">
          <Markdown>{text}</Markdown>
        </div>
      )}
    </div>
  );
}
