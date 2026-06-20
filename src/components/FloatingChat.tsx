"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { Markdown } from "@/components/Markdown";
import { MicButton } from "@/components/MicButton";
import { TYPES, type EntryType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image";

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
  images?: string[];
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
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Draggable launcher position, remembered across reloads.
  const fabX = useMotionValue(0);
  const fabY = useMotionValue(0);
  const downRef = useRef<{ x: number; y: number } | null>(null);

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

  // Let nav entries open the chat directly (optionally in a given mode).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const m = (e as CustomEvent).detail?.mode as Mode | undefined;
      if (m === "wonder" || m === "capture") setMode(m);
      setOpen(true);
    };
    window.addEventListener("lattice:open-chat", onOpen);
    return () => window.removeEventListener("lattice:open-chat", onOpen);
  }, []);

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

  // Auto-grow the composer with its content (capped), and reset after sending.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input, open]);

  async function addImages(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).slice(0, 4 - images.length);
    const compressed = await Promise.all(picked.map((f) => compressImage(f).catch(() => null)));
    setImages((prev) => [...prev, ...(compressed.filter(Boolean) as string[])].slice(0, 4));
  }

  async function send(text: string) {
    const message = text.trim();
    const imgs = images;
    if ((!message && imgs.length === 0) || loading) return;
    window.dispatchEvent(new CustomEvent("lattice:stt-stop"));
    const here = mode;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "you", text: message || (imgs.length ? "📷 (image)" : ""), images: imgs }]);
    setInput("");
    setImages([]);
    setLoading(true);
    try {
      if (here === "wonder") {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "ask", message, history, images: imgs }),
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
          body: JSON.stringify({ message, history, preserveRaw: true, images: imgs }),
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

  // Bridge: turn a Wonder conversation (up to message `index`) into a saved entry.
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
          preserveRaw: false,
        }),
      });
      const data = await res.json();
      setMessages((m) =>
        m
          .map((msg, k) => (k === index ? { ...msg, saved: data.mutated === true } : msg))
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
      {/* Draggable launcher in its own pointer-events-none bounds. */}
      <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-40">
        <motion.button
          drag
          dragConstraints={constraintsRef}
          dragMomentum={false}
          dragElastic={0.05}
          onDragEnd={persistFab}
          onPointerDown={(e) => {
            downRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const d = downRef.current;
            downRef.current = null;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) setOpen(true);
          }}
          initial={false}
          animate={{ opacity: open ? 0 : 1, scale: open ? 0.6 : 1 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Open AI agent (drag to move)"
          style={{ x: fabX, y: fabY, touchAction: "none", pointerEvents: open ? "none" : "auto" }}
          className="glow-violet absolute bottom-24 right-4 grid h-14 w-14 cursor-grab place-items-center rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-sky-600 text-2xl active:cursor-grabbing md:bottom-6 md:right-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30 [animation-duration:3s]" />
          <span className="relative">✦</span>
        </motion.button>
      </div>

      {/* Full-screen chat with a solid backdrop. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] flex flex-col bg-zinc-950"
          >
            {/* Header */}
            <div className="border-b border-white/10 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-lg">
                    ✦
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">Lattice Agent</div>
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
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> ready</>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="press grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {/* Mode toggle */}
              <div className="mx-auto flex w-full max-w-2xl gap-1 px-4 pb-2">
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
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-5">
                {messages.length === 0 && (
                  <div className="pt-8 text-center">
                    <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 text-2xl">
                      {mode === "wonder" ? "🧠" : "✦"}
                    </div>
                    <p className="mx-auto max-w-sm text-sm text-zinc-400">
                      {mode === "wonder"
                        ? "Let's think together — I won't save anything unless you tap Save."
                        : "Tell me what happened in plain words — I'll file it with all the detail kept."}
                    </p>
                    <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2">
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
                        {m.images && m.images.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {m.images.map((src, k) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={k} src={src} alt="attachment" className="h-16 w-16 rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                        {m.role === "ai" ? <Markdown>{m.text}</Markdown> : m.text}
                      </div>
                    </div>

                    {m.role === "ai" && m.steps && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {m.steps
                          .filter((s) => WRITE_TOOLS.has(s.tool))
                          .map((s, j) => (
                            <ActionCard key={j} step={s} onNavigate={() => setOpen(false)} />
                          ))}
                      </div>
                    )}

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
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-white/10"
            >
              {images.length > 0 && (
                <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2 px-4 pt-3">
                  {images.map((src, k) => (
                    <div key={k} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="attachment" className="h-14 w-14 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== k))}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-xs text-zinc-300 ring-1 ring-white/20"
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <label
                  className="press grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5 text-lg text-zinc-300 hover:text-white"
                  aria-label="Attach photo"
                >
                  📷
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // On desktop, Enter sends (Shift+Enter = newline). On touch
                    // keyboards Enter inserts a newline; use the ↑ button to send.
                    if (e.key !== "Enter" || e.shiftKey) return;
                    const coarse =
                      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
                    if (!coarse) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  enterKeyHint="enter"
                  placeholder={mode === "wonder" ? "Think out loud…" : "Tell me what to capture, or paste a long note…"}
                  className="max-h-40 min-h-[2.6rem] flex-1 resize-none overflow-y-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
                />
                <MicButton value={input} onChange={setInput} className="h-10 w-10 shrink-0" />
                <button
                  type="submit"
                  disabled={loading || (!input.trim() && images.length === 0)}
                  className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-600 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  ↑
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
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
