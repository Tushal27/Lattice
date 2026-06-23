"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

// First-run, founder-grade intro: what Lattice is, the core loop, and the wow —
// in ~30 seconds — ending with one tap to see it alive (Demo Mode). Reopenable
// via the "lattice:open-onboarding" event ("Take the tour" in Find).
const SEEN_KEY = "lattice:onboarded-v1";

const LOOP = ["Capture", "Connect", "Recall", "Act", "Learn"];

export function Onboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("lattice:open-onboarding", onOpen);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {}
    return () => window.removeEventListener("lattice:open-onboarding", onOpen);
  }, []);

  function finish() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  async function seeItAlive() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load" }),
      });
    } catch {
      /* ignore — still proceed */
    } finally {
      setLoading(false);
      finish();
      router.push("/");
      router.refresh();
    }
  }

  const steps = [
    {
      kicker: "This is not notes. Not todos.",
      title: (
        <>
          Your judgment, <span className="text-gradient">compounding.</span>
        </>
      ),
      body: "Lattice is a personal operating system for how you think — decisions, lessons, questions, money calls. Capture them once and they keep working for you, so the person you are in five years is measurably wiser.",
      visual: null as React.ReactNode,
    },
    {
      kicker: "One loop",
      title: <>Everything feeds one brain</>,
      body: "You capture in plain words. Lattice connects it by meaning, recalls the right thing at the right moment, acts on it, and learns from how it turned out — sharpening your judgment each cycle.",
      visual: (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {LOOP.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-100">
                {s}
              </span>
              {i < LOOP.length - 1 && <span className="text-zinc-600">→</span>}
            </div>
          ))}
          <div className="mt-2 w-full text-center text-xs text-zinc-500">→ sharper judgment, on repeat</div>
        </div>
      ),
    },
    {
      kicker: "Why it's different",
      title: <>It thinks alongside you</>,
      body: "",
      visual: (
        <ul className="mt-5 space-y-3 text-left">
          {[
            ["🧠", "Catches you repeating a past mistake", "“You decided this before — here’s how it turned out.”"],
            ["📊", "Calibrates your judgment", "Shows whether your confident calls are actually right."],
            ["🤖", "Acts for you — safely", "A trust dial (off · ask · auto) and an audit log of everything it does."],
          ].map(([icon, h, sub]) => (
            <li key={h as string} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <span className="text-lg leading-none">{icon}</span>
              <div>
                <div className="text-sm font-medium text-zinc-100">{h}</div>
                <div className="text-xs text-zinc-500">{sub}</div>
              </div>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const s = steps[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[75] flex flex-col bg-zinc-950"
        >
          {/* Top: skip + progress */}
          <div className="pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-violet-400" : "w-1.5 bg-zinc-700"}`}
                  />
                ))}
              </div>
              <button onClick={finish} className="press text-xs text-zinc-500 hover:text-zinc-300">
                Skip
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 items-center overflow-y-auto">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mx-auto w-full max-w-md px-6 text-center"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">{s.kicker}</div>
              <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-zinc-50">{s.title}</h1>
              {s.body && <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{s.body}</p>}
              {s.visual}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10">
            <div className="mx-auto flex w-full max-w-md gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {!last ? (
                <>
                  <button
                    onClick={finish}
                    className="press rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => setStep((n) => n + 1)}
                    className="press glow-violet flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-3 text-sm font-medium text-white"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={finish}
                    className="press rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Start empty
                  </button>
                  <button
                    onClick={seeItAlive}
                    disabled={loading}
                    className="press glow-violet flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {loading ? "Loading…" : "▶ See it alive"}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
