"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useDragControls, useMotionValue } from "motion/react";
import { Markdown } from "@/components/Markdown";
import { MicButton } from "@/components/MicButton";
import { TYPES, type EntryType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "wonder" | "capture";

interface Step {
  tool: string;
  ok: boolean;
  summary: string;
  entryId?: string;
  entryType?: string;
  entryTitle?: string;
}

interface Msg {
  role: "you" | "ai";
  text: string;
  mode?: Mode;
  source?: "ai" | "local";
  provider?: string;
  steps?: Step[];
  saved?: boolean;
}

const SUGGESTIONS: Record<Mode, string[]> = {
  wonder: [
    "What patterns do you see in my decisions?",
    "Help me think through a tradeoff I'm facing",
    "Challenge an assumption I'm making",
  ],
  capture: [
    "I decided to drop the side project — low energy lately, fairly sure",
    "I learned that shipping small beats planning big",
    "Add a question: how do marketplaces bootstrap supply?",
  ],
};

const WRITE_TOOLS = new Set(["create_entry", "update_entry", "connect_entries"]);
const VERB: Record<string, string> = { create_entry: "Created", update_entry: "Updated", connect_entries: "Linked" };

export function FloatingChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const fabX = useMotionValue(0);
  const fabY = useMotionValue(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lattice:fab");
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number") fabX.set(p.x);
        if (typeof p.y === "number") fabY.set(p.y);
      }
      const savedMode = localStorage.getItem("lattice:mode");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedMode === "wonder" || savedMode === "capture") setMode(savedMode);
    } catch {}
  }, [fabX, fabY]);

  function changeMode(m: Mode) {
    setMode(m);
    try {
      localStorage.setItem("lattice:mode", m);
    } catch {}
  }

  function persistFab() {
    try {
      localStorage.setItem("lattice:fab", JSON.stringify({ x: fabX.get(), y: fabY.get() }));
    } catch {}
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    window.dispatchEvent(new CustomEvent("lattice:stt-stop"));
    const here = mode;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "you", text: message }]);
    setInput("");
    setLoading(true);
    try {
      if (here === "wonder") {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "ask", message }),
        });
        const data = await res.json();
        setMessages((m) => [
          ...m,
          { role: "ai", mode: "wonder", text: data.text, source: data.source, provider: data.provider },
        ]);
      } else {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });
        const data = await res.json();
        setMessages((m) => [
          ...m,
          { role: "ai", mode: "capture", text: data.reply, source: data.source, provider: data.provider, steps: data.steps },
        ]);
        if (data.mutated) router.refresh();
      }
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Couldn't reach the server. Try again.", source: "local" }]);
    } finally {
      setLoading(false);
    }
  }

  // The bridge: turn a Wonder conversation (up to message `index`) into a saved entry.
  async function saveThis(index: number) {
    if (loading) return;
    const history = messages.slice(0, index + 1).map((m) => ({ role: m.role, text: m.text }));
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Save the most important insight or takeaway from our conversation as a Lattice entry. Choose the best type and keep the detail.",
          history,
        }),
      });
      const data = await res.json();
      setMessages((m) =>
        m
          .map((msg, k) => (k === index ? { ...msg, saved: true } : msg))
          .concat([
            { role: "ai", mode: "capture", text: data.reply, source: data.source, provider: data.provider, steps: data.steps },
          ]),
      );
      if (data.mutated) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const lastAi = [...messages].reverse().find((m) => m.role === "ai");

  return (
    <>
      <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-50">
        {/* Draggable launcher — tap to open, drag to move anywhere. */}
        <motion.button
          drag
          dragConstraints={constraintsRef}
          dragMomentum={false}
          dragElastic={0.05}
          onDragEnd={persistFab}
          onTap={() => setOpen(true)}
          initial={false}
          animate={{ opacity: open ? 0 : 1, scale: open ? 0.6 : 1 }}
          whileDrag={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Open AI agent (drag to move)"
          style={{ x: fabX, y: fabY, touchAction: "none", pointerEvents: open ? "none" : "auto" }}
          className="glow-violet absolute bottom-24 right-4 grid h-14 w-14 cursor-grab place-items-center rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-sky-600 text-2xl active:cursor-grabbing md:bottom-6 md:right-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30 [animation-duration:3s]" />
          <span className="relative">✦</span>
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              dragConstraints={constraintsRef}
              dragElastic={0.04}
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="glass pointer-events-auto absolute bottom-20 right-4 flex h-[68dvh] w-[92vw] max-w-[400px] flex-col overflow-hidden rounded-3xl shadow-2xl md:bottom-6 md:right-6 md:h-[560px]"
            >
              {/* Header (drag handle) */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: "none" }}
                className="flex cursor-grab items-center justify-between border-b border-white/10 px-4 py-3 active:cursor-grabbing"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-lg">
                    ✦
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                      Lattice Agent <span className="text-zinc-600">⠿</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      {lastAi ? (
                        lastAi.source === "ai" ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {lastAi.provider ? `connected · ${lastAi.provider}` : "AI connected"}
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> AI off · add a key
                          </>
                        )
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> drag me anywhere
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="press grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1 border-b border-white/10 p-2">
                {(["wonder", "capture"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => changeMode(m)}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      mode === m ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {m === "wonder" ? "🧠 Wonder" : "✦ Capture"}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="pt-2 text-center">
                    <p className="mx-auto max-w-[17rem] text-sm text-zinc-400">
                      {mode === "wonder"
                        ? "Let's think together — I won't save anything unless you tap Save."
                        : "Tell me what happened in plain words — I'll file it with all the detail kept."}
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {SUGGESTIONS[mode].map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-zinc-300 hover:border-violet-400/40 hover:text-violet-200"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.role === "you"
                            ? "max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 px-4 py-2.5 text-sm text-white"
                            : "max-w-[88%] rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100"
                        }
                      >
                        {m.role === "ai" ? <Markdown>{m.text}</Markdown> : m.text}
                      </div>
                    </div>

                    {/* Capture action cards */}
                    {m.role === "ai" && m.steps && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {m.steps
                          .filter((s) => WRITE_TOOLS.has(s.tool))
                          .map((s, j) => (
                            <ActionCard key={j} step={s} onNavigate={() => setOpen(false)} />
                          ))}
                      </div>
                    )}

                    {/* Wonder → save bridge */}
                    {m.role === "ai" && m.mode === "wonder" && m.source === "ai" && (
                      <div className="mt-2">
                        {m.saved ? (
                          <span className="text-[11px] text-emerald-300">✓ saved</span>
                        ) : (
                          <button
                            onClick={() => saveThis(i)}
                            disabled={loading}
                            className="press rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                          >
                            ✦ Save this as an entry
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3">
                      <span className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={mode === "wonder" ? "Think out loud…" : "Tell me what to capture, or ask…"}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
                />
                <MicButton value={input} onChange={setInput} className="h-10 w-10 shrink-0" />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-600 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  ↑
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function ActionCard({ step, onNavigate }: { step: Step; onNavigate: () => void }) {
  const icon = step.entryType ? TYPES[step.entryType as EntryType]?.icon : "🔗";
  const verb = VERB[step.tool] ?? "Did";
  const label = step.ok ? verb : "Couldn't " + verb.toLowerCase();
  const body = (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
        step.ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/25 bg-rose-500/5"
      }`}
    >
      <span className="text-base">{step.ok ? icon : "⚠️"}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-medium ${step.ok ? "text-emerald-300" : "text-rose-300"}`}>{label}</div>
        <div className="truncate text-zinc-200">{step.entryTitle ?? step.summary}</div>
      </div>
      {step.entryId && step.ok && <span className="shrink-0 text-xs text-zinc-500">open →</span>}
    </div>
  );

  if (step.entryId && step.ok) {
    return (
      <Link href={`/entry/${step.entryId}`} onClick={onNavigate} className="press block">
        {body}
      </Link>
    );
  }
  return body;
}
