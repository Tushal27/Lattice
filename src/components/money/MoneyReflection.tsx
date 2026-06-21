"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

// On-demand financial-judgment reflection for the selected period.
export function MoneyReflection({ period }: { period: string }) {
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setText(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "money-reflect", period }),
      });
      const data = await res.json();
      setText(data.text);
      setSource(data.source);
    } catch {
      setText("Couldn't generate a reflection. Try again.");
      setSource("local");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ring-gradient elev rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.07] to-transparent p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-violet-200">✦ Money reflection</h2>
          <p className="text-xs text-violet-200/60">Did this period&apos;s money buy you a better life?</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="press shrink-0 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {loading ? "Thinking…" : text ? "Regenerate" : "Reflect"}
        </button>
      </div>

      {text && (
        <div className="mt-4 border-t border-white/10 pt-4 text-[15px] leading-relaxed text-zinc-200">
          <Markdown>{text}</Markdown>
          {source === "local" && (
            <p className="mt-2 text-xs text-zinc-500">Add an AI key for a deeper, AI-written reflection.</p>
          )}
        </div>
      )}
    </div>
  );
}
