"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

// Founder Demo Mode — one tap fills Lattice with a coherent, realistic dataset so
// every surface is alive (the loop, a live MistakeWarning, calibration, money
// judgment, autonomy history). Fully reversible.
export function DemoControl() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/demo")).json();
        if (!cancelled) setLoaded(Boolean(d.loaded));
      } catch {
        if (!cancelled) setLoaded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: "load" | "clear") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "clear" ? "clear" : "load" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error();
      setLoaded(action === "load");
      toast(action === "load" ? (d.already ? "Demo already loaded" : "Demo loaded — explore it") : "Demo cleared");
      router.refresh();
    } catch {
      toast("Couldn't update the demo", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loaded === null) return null;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-100">🎬 Founder Demo Mode</h3>
      <p className="mt-1.5 text-sm text-zinc-400">
        Fill Lattice with a realistic founder&apos;s brain so every surface comes alive — the capture→connect→recall→act→learn
        loop, a live mistake warning, decision calibration, money judgment, and autonomy history. Reversible.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!loaded ? (
          <button
            onClick={() => run("load")}
            disabled={busy}
            className="press rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Loading…" : "▶ Load demo data"}
          </button>
        ) : (
          <>
            <Link href="/" className="press rounded-lg bg-violet-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600">
              Open dashboard →
            </Link>
            <button
              onClick={() => run("clear")}
              disabled={busy}
              className="press rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
            >
              {busy ? "Clearing…" : "Clear demo data"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
