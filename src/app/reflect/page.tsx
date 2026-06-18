"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

type Period = "week" | "month";

export default function ReflectPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (p: Period) => {
    setLoading(true);
    setText(null);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "reflect", period: p }),
    });
    const data = await res.json();
    setText(data.text);
    setSource(data.source);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch the reflection whenever the selected period changes. The setState
    // calls inside `run` are intentional here (loading + result), so the
    // cascading-render lint rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run(period);
  }, [period, run]);

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon="🔮"
        accentColor="violet"
        title="Reflections"
        subtitle="Step back and let your recent thinking become self-awareness."
      />

      <div className="mb-6 inline-flex rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {(["week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              period === p ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            This {p}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/60 to-zinc-900/20 p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800/70" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800/70" />
          </div>
        ) : text ? (
          <>
            <Markdown>{text}</Markdown>
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              {source === "ai" ? (
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300">✦ written by AI</span>
              ) : (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5">local summary — add an AI key for more</span>
              )}
              <button onClick={() => run(period)} className="hover:text-zinc-300">
                ↻ regenerate
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
