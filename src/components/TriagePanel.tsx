"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

interface Proposal {
  id: string;
  kind: "reply" | "renewal";
  from: string;
  to?: string;
  subject?: string;
  body?: string;
  summary: string;
}

// Inbox triage results from "Scan inbox now": draft replies to review & send, and
// renewal/bill warnings. Action items become commitments directly (not shown here).
export function TriagePanel() {
  const [items, setItems] = useState<Proposal[] | null>(null);

  async function load() {
    try {
      const d = await (await fetch("/api/gmail/proposals")).json();
      setItems(d.proposals ?? []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/gmail/proposals")).json();
        if (!cancelled) setItems(d.proposals ?? []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss(id: string) {
    setItems((x) => x?.filter((p) => p.id !== id) ?? x);
    await fetch("/api/gmail/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-sm font-medium text-zinc-200">📨 From your inbox · {items.length}</h3>
      {items.map((p) =>
        p.kind === "reply" ? (
          <ReplyProposal key={p.id} p={p} onDone={() => dismiss(p.id)} onRefresh={load} />
        ) : (
          <div key={p.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-amber-300">💳 Renewal / bill</div>
                <p className="text-sm text-zinc-200">{p.summary}</p>
                <p className="text-[11px] text-zinc-500">{p.from}</p>
              </div>
              <button onClick={() => dismiss(p.id)} className="press shrink-0 text-xs text-zinc-500 hover:text-zinc-300">
                Dismiss
              </button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function ReplyProposal({ p, onDone, onRefresh }: { p: Proposal; onDone: () => void; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(p.to ?? "");
  const [subject, setSubject] = useState(p.subject ?? "");
  const [body, setBody] = useState(p.body ?? "");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!to.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Send failed");
      toast(`Replied to ${to}`);
      await fetch("/api/gmail/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      onRefresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  const field = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-zinc-100 focus:border-violet-400/40 focus:outline-none";

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-sky-300">↩️ Draft reply</div>
          <p className="truncate text-sm text-zinc-200">{p.subject}</p>
          <p className="truncate text-[11px] text-zinc-500">to {p.from} · {p.summary}</p>
        </div>
        <span className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} className={field} placeholder="recipient" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} placeholder="subject" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={`${field} resize-y leading-relaxed`} />
          <div className="flex gap-2">
            <button
              onClick={send}
              disabled={sending || !to.trim() || !body.trim()}
              className="press rounded-lg bg-sky-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button onClick={onDone} className="press rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
