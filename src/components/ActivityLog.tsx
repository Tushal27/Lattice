"use client";

import { useEffect, useState } from "react";

interface Action {
  id: string;
  capability: string;
  summary: string;
  status: string;
  source: string;
  createdAt: string;
}

const SOURCE_ICON: Record<string, string> = {
  agent: "🧠",
  gmail: "📧",
  calendar: "📅",
  cron: "⏰",
  autonomous: "✨",
  user: "👤",
  file: "📄",
  url: "🔗",
  github: "🐙",
};

function ago(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// A transparent record of everything the assistant did for you — the trust
// receipt behind autonomy.
export function ActivityLog() {
  const [actions, setActions] = useState<Action[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/actions")).json();
        if (!cancelled) setActions(d.actions ?? []);
      } catch {
        if (!cancelled) setActions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!actions) return null;

  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Nothing yet. As the assistant captures, schedules, and acts for you, every action shows up here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-white/5">
      {actions.map((a) => (
        <div key={a.id} className="flex items-start gap-3 p-3">
          <span className="mt-0.5 text-base">{SOURCE_ICON[a.source] ?? "•"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-200">{a.summary}</p>
            <p className="text-[11px] text-zinc-600">
              {a.source} · {ago(a.createdAt)}
              {a.status !== "done" && <span className="ml-1 text-amber-400">· {a.status}</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
