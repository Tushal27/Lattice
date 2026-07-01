"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

interface AiConfig {
  rosterOnly: boolean;
  rosterConfigured: boolean;
  providers: string[];
}

// Choose whether the AI engine may fall back to public providers (Groq, etc.)
// when your own roster endpoint is down/rate-limited, or should stay roster-only.
export function AiProviderToggle() {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = (await (await fetch("/api/ai/config")).json()) as AiConfig;
        if (!cancelled) setCfg(d);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!cfg || busy) return;
    const next = !cfg.rosterOnly;
    setCfg({ ...cfg, rosterOnly: next });
    setBusy(true);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterOnly: next }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as AiConfig;
      setCfg(d);
      toast(next ? "Using your roster only" : "Fallback providers enabled");
    } catch {
      setCfg({ ...cfg, rosterOnly: !next });
      toast("Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return null;

  const fallbacks = cfg.providers.filter((p) => p !== "custom");

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-zinc-100">Use my roster only</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {cfg.rosterOnly
              ? "Every request goes to your own AI endpoint only — no fallback."
              : fallbacks.length > 0
                ? `If your roster is down or rate-limited, fall back to: ${fallbacks.join(", ")}.`
                : "No fallback providers are configured, so requests already use your roster only."}
          </p>
        </div>

        <button
          role="switch"
          aria-checked={cfg.rosterOnly}
          onClick={toggle}
          disabled={busy}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            cfg.rosterOnly ? "bg-violet-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              cfg.rosterOnly ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {cfg.rosterOnly && !cfg.rosterConfigured && (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          ⚠️ Your roster endpoint isn&apos;t configured (set <span className="font-mono">AI_BASE_URL</span> +{" "}
          <span className="font-mono">AI_API_KEY</span>), so AI features are off while this is on. Turn it off to use the
          fallback providers instead.
        </p>
      )}
    </div>
  );
}
