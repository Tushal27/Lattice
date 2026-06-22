"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

type Status = { enabled: boolean; connected: boolean; email: string | null };
interface CalEvent { id: string; summary: string; start: string; allDay: boolean }

// One Google connection powers awareness (Gmail read + Calendar) and action
// (calendar events). Inert until Google OAuth creds are configured.
export function GoogleConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = (await (await fetch("/api/google/status")).json()) as Status;
      setStatus(s);
      if (s.connected) {
        try {
          const d = await (await fetch("/api/calendar/events")).json();
          setEvents(d.events ?? []);
        } catch {
          setEvents([]);
        }
      }
    } catch {
      setStatus({ enabled: false, connected: false, email: null });
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await (await fetch("/api/google/status")).json()) as Status;
        if (cancelled) return;
        setStatus(s);
        if (s.connected) {
          const d = await (await fetch("/api/calendar/events")).json();
          if (!cancelled) setEvents(d.events ?? []);
        }
      } catch {
        if (!cancelled) setStatus({ enabled: false, connected: false, email: null });
      }
    })();
    const g = new URLSearchParams(window.location.search).get("google");
    if (g === "connected") toast("Google connected");
    else if (g === "denied") toast("Google access was declined", "error");
    else if (g === "error" || g === "nocode") toast("Couldn't connect Google", "error");
    return () => {
      cancelled = true;
    };
  }, []);

  async function scanInbox() {
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
      if (!res.ok) throw new Error(data?.error ?? "Scan failed");
      setLastSync(data.message ?? "Done.");
      if (data.created?.length) toast(`Captured ${data.created.length} from email`);
    } catch (e) {
      toast((e as Error).message || "Scan failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      toast("Google disconnected");
      setEvents(null);
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
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">🔗 Google</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Connect Gmail (read-only) and Google Calendar so the assistant can see your world and schedule for you. To
          switch it on, add <code className="rounded bg-white/10 px-1 text-zinc-200">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="rounded bg-white/10 px-1 text-zinc-200">GOOGLE_CLIENT_SECRET</code> to your deployment.
        </p>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className={`${base} border-sky-500/20 bg-sky-500/5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">🔗 Google</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          One connection grants Gmail (read-only, to capture action items) and Calendar (to read your schedule and add
          events). You stay in control of what the assistant does — see Permissions below.
        </p>
        <a
          href="/api/google/connect"
          className="press mt-3 inline-block rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          Connect Google →
        </a>
      </div>
    );
  }

  return (
    <div className={`${base} border-emerald-500/20 bg-emerald-500/5`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-100">🔗 Google connected</h3>
      {status.email && <p className="mt-0.5 text-xs text-emerald-200/70">{status.email}</p>}
      <p className="mt-1.5 text-sm text-zinc-300">Gmail (read-only) + Calendar. The assistant can see your schedule and act within your permissions.</p>

      {events && events.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">Next on your calendar</p>
          <ul className="space-y-1">
            {events.slice(0, 4).map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="text-xs text-zinc-500">
                  {e.allDay
                    ? "all day"
                    : new Date(e.start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="truncate">{e.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={scanInbox}
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
