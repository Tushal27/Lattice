"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";

const KEY = "lattice:brief";

type Cached = { day: string; slot: string; text: string };

// Which part of the day we're in — the brief refreshes when this changes, so the
// morning brief and the evening brief feel different without spamming the AI.
function slotOf(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// Jarvis's "good morning" — a single, prioritized read of my whole world right
// now. Cached per day-slot in localStorage so it's instant on revisit and only
// hits the AI when the day or part-of-day actually changes.
export function DailyBrief() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBrief = useCallback(async (force = false) => {
    const day = dayKey();
    const slot = slotOf();

    if (!force) {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const c = JSON.parse(raw) as Cached;
          if (c.day === day && c.slot === slot && c.text) {
            setText(c.text);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "brief" }),
      });
      const data = await res.json();
      if (data?.text) {
        setText(data.text);
        try {
          localStorage.setItem(KEY, JSON.stringify({ day, slot, text: data.text } satisfies Cached));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* silent — the brief is a nicety, not load-bearing */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait until the dashboard is interactive so the brief never blocks paint.
    const t = setTimeout(() => fetchBrief(false), 600);
    return () => clearTimeout(t);
  }, [fetchBrief]);

  if (!text && !loading) return null;

  return (
    <section className="ring-gradient elev relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-white/[0.02] to-transparent p-6">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-200">
            <span>✦</span> Your brief
          </h2>
          <button
            onClick={() => fetchBrief(true)}
            disabled={loading}
            className="press shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Reading…" : "↻ Refresh"}
          </button>
        </div>
        {loading && !text && (
          <div className="space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800/70" />
          </div>
        )}
        {text && (
          <div className="text-[15px] leading-relaxed text-zinc-200">
            <Markdown>{text}</Markdown>
          </div>
        )}
      </div>
    </section>
  );
}
