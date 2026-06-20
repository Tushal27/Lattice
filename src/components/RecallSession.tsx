"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { TypeBadge } from "@/components/ui";

export interface RecallCard {
  id: string;
  type: string;
  title: string;
  answer: string;
}

function templated(c: RecallCard) {
  return c.type === "aha" ? `What was the insight behind "${c.title}"?` : `What did you take away from "${c.title}"?`;
}

export function RecallSession({ cards }: { cards: RecallCard[] }) {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0); // count rated
  const [questions, setQuestions] = useState<Record<string, string>>({});
  const fetched = useRef(false);

  // Fetch sharper AI questions in the background; templated shown until then.
  useEffect(() => {
    if (fetched.current || cards.length === 0) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "quiz",
            items: cards.map((c) => ({ id: c.id, type: c.type, title: c.title, content: c.answer })),
          }),
        });
        if (res.ok) setQuestions(await res.json());
      } catch {}
    })();
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
        <div className="mb-3 text-4xl opacity-60">🎯</div>
        <p className="text-zinc-300">Nothing to test yet.</p>
        <p className="mt-1 text-sm text-zinc-500">Capture a few lessons or aha moments and come back.</p>
        <Link href="/capture" className="mt-3 inline-block text-sm font-medium text-violet-300 hover:underline">
          Capture one →
        </Link>
      </div>
    );
  }

  if (i >= cards.length) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-14 text-center animate-[pop_0.3s_ease-out]">
        <div className="mb-3 text-4xl">✅</div>
        <p className="text-lg font-semibold text-zinc-100">Reviewed {done} {done === 1 ? "card" : "cards"}.</p>
        <p className="mt-1 text-sm text-zinc-400">Recalling your own insights is how they stick.</p>
        <button
          onClick={() => {
            setI(0);
            setRevealed(false);
            setDone(0);
          }}
          className="press mt-4 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2 text-sm font-medium text-white"
        >
          Go again
        </button>
      </div>
    );
  }

  const card = cards[i];
  const q = questions[card.id] ?? templated(card);

  function next() {
    setRevealed(false);
    setDone((d) => d + 1);
    setI((n) => n + 1);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Card {i + 1} of {cards.length}
        </span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400" style={{ width: `${(i / cards.length) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="ring-gradient min-h-[16rem] rounded-2xl border border-white/8 bg-white/[0.03] p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <TypeBadge type={card.type} size="xs" />
            <span className="text-xs text-zinc-500">recall</span>
          </div>
          <p className="text-lg font-medium text-zinc-100">{q}</p>

          {revealed ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Your note said</p>
              <p className="whitespace-pre-line [overflow-wrap:anywhere] text-zinc-200">{card.answer || card.title}</p>
              <Link href={`/entry/${card.id}`} className="mt-3 inline-block text-xs text-violet-300 hover:underline">
                open entry →
              </Link>
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-500">Think it through, then reveal.</p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex gap-2">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="press flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
          >
            Reveal
          </button>
        ) : (
          <>
            <button
              onClick={next}
              className="press flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
            >
              Fuzzy — show again later
            </button>
            <button
              onClick={next}
              className="press flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              Got it ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}
