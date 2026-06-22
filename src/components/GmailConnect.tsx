"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

type Status = { enabled: boolean; connected: boolean; email: string | null };

// Connect Gmail (read-only) so Lattice can scan recent mail and turn real
// action items into commitments. Inert until Google OAuth creds are configured.
export function GmailConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = (await (await fetch("/api/gmail/status")).json()) as Status;
      setStatus(s);
    } catch {
      setStatus({ enabled: false, connected: false, email: null });
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await (await fetch("/api/gmail/status")).json()) as Status;
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus({ enabled: false, connected: false, email: null });
      }
    })();
    // Surface the result of the OAuth redirect (…/settings?gmail=connected).
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gmail");
    if (g === "connected") toast("Gmail connected");
    else if (g === "denied") toast("Gmail access was declined", "error");
    else if (g === "error" || g === "nocode") toast("Couldn't connect Gmail", "error");
    return () => {
      cancelled = true;
    };
  }, []);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setLastSync(null);
    try {
      const tz = -new Date().getTimezoneOffset();
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sync failed");
      setLastSync(data.message ?? "Done.");
      if (data.created?.length) toast(`Captured ${data.created.length} from email`);
    } catch (e) {
      toast((e as Error).message || "Sync failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      toast("Gmail disconnected");
      await refresh();
      setLastSync(null);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const base = "rounded-2xl border p-5";

  if (!status.enabled) {
    return (
      <div className={`${base} border-zinc-800/80 bg-zinc-900/40`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">📧 Gmail</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Let Lattice read recent mail and turn real action items into commitments. To switch it on, add{" "}
          <code className="rounded bg-white/10 px-1 text-zinc-200">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="rounded bg-white/10 px-1 text-zinc-200">GOOGLE_CLIENT_SECRET</code> to your deployment.
        </p>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className={`${base} border-rose-500/20 bg-rose-500/5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">📧 Gmail</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Connect your inbox (read-only) and Lattice will surface commitments hiding in your recent email.
        </p>
        <a
          href="/api/gmail/connect"
          className="press mt-3 inline-block rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2 text-sm font-medium text-white"
        >
          Connect Gmail →
        </a>
      </div>
    );
  }

  return (
    <div className={`${base} border-emerald-500/20 bg-emerald-500/5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-100">📧 Gmail connected</h3>
          {status.email && <p className="mt-0.5 text-xs text-emerald-200/70">{status.email}</p>}
          <p className="mt-1.5 text-sm text-zinc-300">
            Read-only. Scans recent inbox mail and captures real action items as commitments.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={sync}
          disabled={busy}
          className="press rounded-lg bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "✦ Scan inbox now"}
        </button>
        <button
          onClick={disconnect}
          disabled={busy}
          className="press rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      {lastSync && <p className="mt-3 text-sm text-emerald-200/80">{lastSync}</p>}
    </div>
  );
}
