"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export interface CommitmentDTO {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  recurringRule: string | null;
  priority: string | null;
  sourceType: string | null;
  createdAt: string;
}

interface Groups {
  overdue: CommitmentDTO[];
  today: CommitmentDTO[];
  upcoming: CommitmentDTO[];
  done: CommitmentDTO[];
}

interface Review {
  completed: number;
  missed: number;
  completionPct: number | null;
  streak: number;
}

function dueLabel(iso: string | null): string {
  if (!iso) return "someday";
  const d = new Date(iso);
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const atTime = d.getHours() === 0 && d.getMinutes() === 0 ? "" : ` · ${time}`;
  if (diffDays === 0) return `today${atTime}`;
  if (diffDays === 1) return `tomorrow${atTime}`;
  if (diffDays === -1) return `yesterday${atTime}`;
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })}${atTime}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + atTime;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-zinc-500",
};

export function CommitmentList({ initial, review }: { initial: Groups; review: Review }) {
  const [groups, setGroups] = useState<Groups>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch("/api/commitments");
    if (res.ok) {
      const data = await res.json();
      setGroups({ overdue: data.overdue, today: data.today, upcoming: data.upcoming, done: data.done });
    }
  }

  async function act(id: string, action: "complete" | "snooze" | "cancel") {
    setBusy(id);
    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast(action === "complete" ? "Done — nice." : action === "snooze" ? "Snoozed to tomorrow" : "Removed");
      await refresh();
    } catch {
      toast("Couldn't update that", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/commitments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Removed");
      await refresh();
    } catch {
      toast("Couldn't remove that", "error");
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, due: due.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setDue("");
      toast("Commitment set");
      await refresh();
    } catch {
      toast("Couldn't add that", "error");
    } finally {
      setAdding(false);
    }
  }

  const empty =
    groups.overdue.length === 0 &&
    groups.today.length === 0 &&
    groups.upcoming.length === 0 &&
    groups.done.length === 0;

  return (
    <div className="space-y-8">
      {/* Quick add */}
      <form onSubmit={add} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to follow through on?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/50 focus:outline-none"
          />
          <input
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="when? e.g. tomorrow 9am"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/50 focus:outline-none sm:w-52"
          />
          <button
            type="submit"
            disabled={adding || !title.trim()}
            className="press rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Natural language works: “next monday”, “in 3 days”, “every morning”, “2026-07-01”.
        </p>
      </form>

      {/* Weekly review summary */}
      {(review.completed > 0 || review.missed > 0 || review.streak > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Done this week" value={review.completed} accent="text-emerald-300" />
          <Stat
            label="Follow-through"
            value={review.completionPct == null ? "—" : `${review.completionPct}%`}
            accent="text-sky-300"
          />
          <Stat label="Day streak" value={review.streak} accent="text-amber-300" />
        </div>
      )}

      {empty && (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <p className="text-zinc-300">No commitments yet.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Tell the ✦ agent “remind me to review the pricing decision next week,” or add one above.
          </p>
        </div>
      )}

      <Section title="Overdue" tone="rose" items={groups.overdue} busy={busy} onAct={act} onRemove={remove} />
      <Section title="Today" tone="emerald" items={groups.today} busy={busy} onAct={act} onRemove={remove} />
      <Section title="Upcoming" tone="zinc" items={groups.upcoming} busy={busy} onAct={act} onRemove={remove} />

      {groups.done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Recently done</h2>
          <div className="space-y-2">
            {groups.done.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-2.5 text-sm"
              >
                <span className="text-emerald-400">✓</span>
                <span className="min-w-0 flex-1 truncate text-zinc-500 line-through">{c.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-center">
      <div className={cn("text-2xl font-semibold", accent)}>{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}

const TONE: Record<string, string> = {
  rose: "border-rose-500/20 bg-rose-500/5",
  emerald: "border-emerald-500/20 bg-emerald-500/5",
  zinc: "border-zinc-800/80 bg-zinc-900/40",
};
const TONE_TEXT: Record<string, string> = {
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  zinc: "text-zinc-400",
};

function Section({
  title,
  tone,
  items,
  busy,
  onAct,
  onRemove,
}: {
  title: string;
  tone: string;
  items: CommitmentDTO[];
  busy: string | null;
  onAct: (id: string, action: "complete" | "snooze" | "cancel") => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className={cn("mb-3 text-sm font-semibold uppercase tracking-wider", TONE_TEXT[tone])}>
        {title} <span className="text-zinc-600">· {items.length}</span>
      </h2>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className={cn("flex items-center gap-3 rounded-xl border p-3.5", TONE[tone])}
            >
              <button
                onClick={() => onAct(c.id, "complete")}
                disabled={busy === c.id}
                aria-label="Mark done"
                className="press grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/20 text-transparent transition-colors hover:border-emerald-400 hover:text-emerald-400"
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {c.priority && PRIORITY_DOT[c.priority] && (
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[c.priority])} />
                  )}
                  <span className="truncate text-sm text-zinc-100">{c.title}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>{dueLabel(c.dueDate)}</span>
                  {c.recurringRule && <span>· 🔁 {c.recurringRule}</span>}
                </div>
              </div>
              <button
                onClick={() => onAct(c.id, "snooze")}
                disabled={busy === c.id}
                className="press shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              >
                Snooze
              </button>
              <button
                onClick={() => onRemove(c.id)}
                disabled={busy === c.id}
                aria-label="Remove"
                className="press shrink-0 rounded-lg px-1.5 py-1 text-xs text-zinc-600 hover:bg-white/10 hover:text-rose-300"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
