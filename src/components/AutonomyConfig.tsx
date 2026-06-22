"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

interface Config {
  reviewAgeDays: number;
  scheduleHour: number;
  quietStart: number;
  quietEnd: number;
  tz: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

// Tune how autonomy behaves: how old a decision must be before a review is
// auto-scheduled, when blocks land, and when to stay quiet.
export function AutonomyConfig() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = (await (await fetch("/api/autonomy/config")).json()) as Config;
        if (!cancelled) setCfg(d);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Partial<Config>) {
    if (!cfg) return;
    const next = { ...cfg, ...patch, tz: -new Date().getTimezoneOffset() };
    setCfg(next);
    setSaving(true);
    try {
      await fetch("/api/autonomy/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      toast("Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) return null;

  const field = "rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-zinc-100 focus:border-violet-400/40 focus:outline-none";

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-medium text-zinc-100">Autonomy tuning</h3>
      <p className="mt-0.5 text-xs text-zinc-500">How the assistant times what it does for you{saving ? " · saving…" : ""}.</p>

      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span className="text-zinc-300">Review decisions older than</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={120}
              value={cfg.reviewAgeDays}
              onChange={(e) => save({ reviewAgeDays: Number(e.target.value) })}
              className={`${field} w-16`}
            />
            <span className="text-zinc-500">days</span>
          </span>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-zinc-300">Schedule review blocks at</span>
          <select value={cfg.scheduleHour} onChange={(e) => save({ scheduleHour: Number(e.target.value) })} className={field}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-zinc-300">Quiet hours (no nudges)</span>
          <span className="flex items-center gap-1.5">
            <select value={cfg.quietStart} onChange={(e) => save({ quietStart: Number(e.target.value) })} className={field}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
            <span className="text-zinc-500">–</span>
            <select value={cfg.quietEnd} onChange={(e) => save({ quietEnd: Number(e.target.value) })} className={field}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
    </div>
  );
}
