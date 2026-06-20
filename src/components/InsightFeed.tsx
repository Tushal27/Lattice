"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export interface InsightDTO {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
}

const STYLE: Record<string, { icon: string; accent: string; chip: string }> = {
  DecisionReviewReady: { icon: "⏳", accent: "border-amber-500/25 bg-amber-500/5", chip: "text-amber-300" },
  MistakeWarning: { icon: "⚠️", accent: "border-rose-500/25 bg-rose-500/5", chip: "text-rose-300" },
  ForgottenQuestion: { icon: "❓", accent: "border-sky-500/25 bg-sky-500/5", chip: "text-sky-300" },
  EmergingInterest: { icon: "📈", accent: "border-emerald-500/25 bg-emerald-500/5", chip: "text-emerald-300" },
  ProjectStalled: { icon: "🚧", accent: "border-zinc-700 bg-zinc-900/40", chip: "text-zinc-300" },
  CommitmentOpportunity: { icon: "🎯", accent: "border-violet-500/25 bg-violet-500/5", chip: "text-violet-300" },
  RepeatedPattern: { icon: "🔁", accent: "border-fuchsia-500/25 bg-fuchsia-500/5", chip: "text-fuchsia-300" },
};

const LABEL: Record<string, string> = {
  DecisionReviewReady: "Review",
  MistakeWarning: "Heads up",
  ForgottenQuestion: "Forgotten",
  EmergingInterest: "Emerging",
  ProjectStalled: "Stalled",
  CommitmentOpportunity: "Opportunity",
  RepeatedPattern: "Pattern",
};

function hrefFor(i: InsightDTO): string | null {
  if (i.type === "DecisionReviewReady" && i.entityId) return `/entry/${i.entityId}/edit`;
  if (i.entityId) return `/entry/${i.entityId}`;
  if (i.type === "RepeatedPattern" || i.type === "EmergingInterest") return "/patterns";
  return null;
}

export function InsightFeed({ initial }: { initial: InsightDTO[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function dismiss(id: string) {
    setBusy(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
    } catch {}
    setBusy(null);
  }

  async function act(i: InsightDTO) {
    // Only CommitmentOpportunity has an inline action: create the follow-through.
    setBusy(i.id);
    try {
      const title = i.title.replace(/^Turn into action:\s*/, "");
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Review: ${title}`,
          due: "in 14 days",
          sourceType: "insight",
          sourceId: i.entityId,
          tz: new Date().getTimezoneOffset(),
        }),
      });
      if (!res.ok) throw new Error();
      await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: i.id, action: "act" }),
      });
      setItems((prev) => prev.filter((x) => x.id !== i.id));
      toast("Follow-through added");
      router.refresh();
    } catch {
      toast("Couldn't add that", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">✨ For you</h2>
        <span className="text-xs text-zinc-500">{items.length} insight{items.length > 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {items.map((i) => {
            const s = STYLE[i.type] ?? STYLE.RepeatedPattern;
            const href = hrefFor(i);
            return (
              <motion.div
                key={i.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={cn("relative rounded-2xl border p-4", s.accent)}
              >
                <button
                  onClick={() => dismiss(i.id)}
                  disabled={busy === i.id}
                  aria-label="Dismiss"
                  className="press absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                >
                  ✕
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <span className="text-lg leading-none">{s.icon}</span>
                  <div className="min-w-0">
                    <div className={cn("text-[11px] font-medium uppercase tracking-wide", s.chip)}>
                      {LABEL[i.type] ?? "Insight"}
                    </div>
                    <p className="mt-0.5 font-medium text-zinc-100">{i.title}</p>
                    {i.body && <p className="mt-1 text-sm text-zinc-400">{i.body}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      {i.type === "CommitmentOpportunity" && (
                        <button
                          onClick={() => act(i)}
                          disabled={busy === i.id}
                          className="press rounded-lg bg-violet-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                        >
                          ＋ Add reminder
                        </button>
                      )}
                      {href && (
                        <Link href={href} className="text-xs font-medium text-zinc-300 hover:text-white">
                          {i.type === "DecisionReviewReady" ? "Judge it →" : "Open →"}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
