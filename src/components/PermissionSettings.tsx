"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

type Trust = "off" | "ask" | "auto";
interface Cap {
  key: string;
  label: string;
  description: string;
  outward: boolean;
  trust: Trust;
}

const LEVELS: { value: Trust; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "Never" },
  { value: "ask", label: "Ask", hint: "Suggest, I confirm" },
  { value: "auto", label: "Auto", hint: "Act, then report" },
];

// How much the assistant is trusted to act on its own, per capability. This is
// the dial from "suggest + confirm" toward "act + report."
export function PermissionSettings() {
  const [caps, setCaps] = useState<Cap[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/permissions")).json();
        if (!cancelled) setCaps(d.capabilities ?? []);
      } catch {
        if (!cancelled) setCaps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function set(key: string, trust: Trust) {
    setSaving(key);
    setCaps((prev) => prev?.map((c) => (c.key === key ? { ...c, trust } : c)) ?? prev);
    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, trust }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast("Couldn't save that setting", "error");
    } finally {
      setSaving(null);
    }
  }

  if (!caps) return null;

  return (
    <div className="space-y-3">
      {caps.map((c) => (
        <div key={c.key} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                {c.label}
                {c.outward && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">reaches out</span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">{c.description}</p>
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-lg border border-white/10 p-0.5">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => set(c.key, l.value)}
                disabled={saving === c.key}
                title={l.hint}
                className={`press rounded-md px-3 py-1 text-xs transition-colors ${
                  c.trust === l.value ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
