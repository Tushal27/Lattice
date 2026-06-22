"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

// Run the autonomy engine on demand (it also runs from the cron). Acts only on
// capabilities set to Auto above, and reports exactly what it did.
export function AutonomyNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/autonomy/run", { method: "POST" });
      const data = await res.json();
      const actions: string[] = data.actions ?? [];
      setResult(actions);
      toast(actions.length ? `Did ${actions.length} thing${actions.length > 1 ? "s" : ""}` : "Nothing to act on right now");
      if (actions.length) router.refresh();
    } catch {
      toast("Couldn't run autonomy", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">Run autonomy now</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Acts on your Auto capabilities — schedules reviews, surfaces forgotten work, flags money drift.</p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="press shrink-0 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {busy ? "Running…" : "✦ Run now"}
        </button>
      </div>
      {result && (
        <div className="mt-3 border-t border-white/5 pt-3 text-sm">
          {result.length === 0 ? (
            <p className="text-zinc-500">Nothing needed doing right now.</p>
          ) : (
            <ul className="space-y-1">
              {result.map((a, i) => (
                <li key={i} className="text-emerald-200/80">✓ {a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
