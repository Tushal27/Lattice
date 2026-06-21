"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

const SATISFACTION = ["Regret", "Meh", "Worth it", "Great"];
const SAT_STYLE: Record<string, string> = {
  Regret: "border-rose-400/50 bg-rose-500/15 text-rose-200",
  Meh: "border-zinc-400/40 bg-white/10 text-zinc-200",
  "Worth it": "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  Great: "border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
};

// Log an expense in seconds — what, how much, and how worth-it it felt.
export function QuickSpend() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [sat, setSat] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amount.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "expense", title: title.trim(), amount: amount.trim(), satisfaction: sat || undefined }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setAmount("");
      setSat("");
      toast("Logged");
      router.refresh();
    } catch {
      toast("Couldn't log that", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="elev rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did you spend on?"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-rose-400/40 focus:outline-none"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="amount"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-rose-400/40 focus:outline-none sm:w-32"
        />
        <button
          type="submit"
          disabled={busy || !title.trim() || !amount.trim()}
          className="press rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Log
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-zinc-500">worth it?</span>
        {SATISFACTION.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSat(sat === s ? "" : s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              sat === s ? SAT_STYLE[s] : "border-white/10 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-600">or say it to ✦: “spent ₹500 on lunch, meh”</span>
      </div>
    </form>
  );
}
