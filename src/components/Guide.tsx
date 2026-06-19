"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const SEEN_KEY = "lattice:guide-seen";

const STEPS = [
  {
    icon: "🟣",
    title: "The one rule",
    body: "Capture the moment it happens — don't organize. The AI files it, tags it, and connects it for you.",
  },
  {
    icon: "🎤",
    title: "Daily · Capture  (~2 min)",
    body: "Tap the ✦ bubble → Capture and just say it (voice works great): “Decided to…”, “Learned that…”, “Aha — …”, “Question: …”. It picks the type, fills the fields, and adds tags.",
  },
  {
    icon: "☀️",
    title: "Morning · Review  (~1 min)",
    body: "Open Review: judge a decision old enough to grade, revisit a resurfaced lesson, and see “on this day.” Adding how a decision turned out is what sharpens your judgment.",
  },
  {
    icon: "🔮",
    title: "Weekly · Reflect  (~5 min)",
    body: "Reflections → This week. Read what the AI noticed — your best call, biggest risk, a pattern, an open question.",
  },
  {
    icon: "🧠",
    title: "Anytime · Wonder",
    body: "✦ → Wonder to think out loud — nothing is saved. Reach a conclusion worth keeping? Tap “✦ Save this as an entry.”",
  },
  {
    icon: "📊",
    title: "Monthly · Explore",
    body: "Patterns and the Knowledge Graph show how you think — recurring themes, decision calibration, clusters of ideas. Pure payoff; nothing to maintain.",
  },
];

export function Guide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("lattice:open-guide", onOpen);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {}
    return () => window.removeEventListener("lattice:open-guide", onOpen);
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  function startCapturing() {
    close();
    window.dispatchEvent(new CustomEvent("lattice:open-chat", { detail: { mode: "capture" } }));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex flex-col bg-zinc-950"
        >
          {/* Header */}
          <div className="border-b border-white/10 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white">
                  ⌘
                </span>
                <span className="text-sm font-semibold text-zinc-100">How to use Lattice</span>
              </div>
              <button
                onClick={close}
                className="press grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-5 py-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-gradient">Two habits.</span> Everything else builds itself.
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Capture in the moment, review on a rhythm. That&apos;s the whole system — the rest is payoff.
              </p>

              <div className="mt-6 space-y-3">
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="ring-gradient rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none">{s.icon}</span>
                      <div>
                        <h3 className="font-medium text-zinc-100">{s.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-4">
                <p className="text-sm text-zinc-200">
                  <span className="font-medium text-violet-200">Week 1:</span> do only Capture — five things a day, by
                  voice. Ignore everything else. Once you have material, Review and Reflections start feeling like a
                  conversation with your past self. That&apos;s the hook.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10">
            <div className="mx-auto flex w-full max-w-2xl gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={close}
                className="press flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Got it
              </button>
              <button
                onClick={startCapturing}
                className="press glow-violet flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
              >
                ✦ Capture something
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
