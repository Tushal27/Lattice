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
import {
  getRecognitionCtor,
  speak,
  stopSpeaking,
  voiceInSupported,
  voiceOutSupported,
  type RecognitionLike,
} from "@/lib/voice";

type Mode = "wonder" | "capture";

interface Step {
  tool: string;
  ok: boolean;
  summary: string;
  entryId?: string;
  entryType?: string;
  entryTitle?: string;
}

interface Suggestion {
  title: string;
  due: string;
  sourceType: string;
  sourceId: string;
}

interface EmailDraft {
  to: string;
  subject: string;
  body: string;
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
  suggestion?: Suggestion;
  emailDraft?: EmailDraft;
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

const WRITE_TOOLS = new Set(["create_entry", "update_entry", "connect_entries", "create_commitment", "create_calendar_event"]);
const VERB: Record<string, string> = {
  create_entry: "Created",
  update_entry: "Updated",
  connect_entries: "Linked",
  create_commitment: "Committed",
  create_calendar_event: "Scheduled",
};

export function FloatingChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [memory, setMemory] = useState("");
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  // Hands-free conversation mode (voice in → answer → voice out → listen again).
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const voiceOnRef = useRef(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef("");
  const recErrorRef = useRef(false);
  const sendRef = useRef<(t: string) => Promise<string>>(async () => "");
  const [attachOpen, setAttachOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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
      // Restore the working thread + rolling memory so it survives app close.
      const savedChat = localStorage.getItem("lattice:chat");
      if (savedChat) {
        const c = JSON.parse(savedChat);
        if (Array.isArray(c.messages)) setMessages(c.messages.slice(-50));
        if (typeof c.memory === "string") setMemory(c.memory);
      }
    } catch {}
  }, [fabX, fabY]);

  // Persist the thread + memory (capped — this isn't a chat app, just a robust
  // working thread).
  useEffect(() => {
    try {
      localStorage.setItem("lattice:chat", JSON.stringify({ messages: messages.slice(-50), memory }));
    } catch {}
  }, [messages, memory]);

  // Memory is server-authoritative now (shared across devices). Load it on
  // mount; if this device still has only-local memory, migrate it up once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/memory")).json();
        if (cancelled) return;
        const server = typeof d.memory === "string" ? d.memory : "";
        if (server) {
          setMemory(server);
        } else {
          const local = (() => {
            try {
              return JSON.parse(localStorage.getItem("lattice:chat") || "{}").memory || "";
            } catch {
              return "";
            }
          })();
          if (local) {
            fetch("/api/memory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memory: local }),
            }).catch(() => {});
          }
        }
      } catch {
        /* keep whatever was restored from localStorage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Voice support is client-only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(voiceInSupported());
  }, []);

  // Tearing down: if the chat closes while a conversation is live, end it.
  useEffect(() => {
    if (!open && voiceOnRef.current) stopConversation();
  }, [open]);

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

  async function send(text: string): Promise<string> {
    const message = text.trim();
    const imgs = images;
    if ((!message && imgs.length === 0) || loading) return "";
    window.dispatchEvent(new CustomEvent("lattice:stt-stop"));
    const here = mode;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "you", text: message || (imgs.length ? "📷 (image)" : ""), images: imgs }]);
    setInput("");
    setImages([]);
    setLoading(true);
    let replyText = "";
    try {
      if (here === "wonder" && imgs.length === 0) {
        // Streaming path — render tokens the instant they arrive.
        setMessages((m) => [...m, { role: "ai", mode: "wonder", text: "", source: "ai" }]);
        let acc = "";
        try {
          const res = await fetch("/api/ai/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history }),
          });
          if (!res.ok || !res.body) throw new Error("no stream");
          const src: "ai" | "local" = res.headers.get("X-AI") === "off" ? "local" : "ai";
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let started = false;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += dec.decode(value, { stream: true });
            if (!started) {
              started = true;
              setStreaming(true);
            }
            setMessages((m) => {
              const c = m.slice();
              const last = c[c.length - 1];
              if (last && last.role === "ai") c[c.length - 1] = { ...last, text: acc, source: src };
              return c;
            });
          }
          if (!acc.trim()) throw new Error("empty");
          replyText = acc;
        } catch {
          // Fall back to the blocking endpoint (also serves the no-key message).
          try {
            const res = await fetch("/api/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task: "ask", message, history }),
            });
            const data = await res.json();
            replyText = data.text ?? "";
            setMessages((m) => {
              const c = m.slice();
              c[c.length - 1] = { role: "ai", mode: "wonder", text: data.text, source: data.source, provider: data.provider };
              return c;
            });
          } catch {
            setMessages((m) => {
              const c = m.slice();
              c[c.length - 1] = { role: "ai", mode: "wonder", text: "Couldn't reach the server. Try again.", source: "local" };
              return c;
            });
          }
        } finally {
          setStreaming(false);
        }
      } else if (here === "wonder") {
        // Wonder with an image attached → vision (non-streaming).
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "ask", message, history, images: imgs }),
        });
        const data = await res.json();
        replyText = data.text ?? "";
        setMessages((m) => [
          ...m,
          { role: "ai", mode: "wonder", text: data.text, source: data.source, provider: data.provider },
        ]);
      } else {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history, preserveRaw: true, images: imgs, tz: new Date().getTimezoneOffset(), memory }),
        });
        const data = await res.json();
        replyText = data.reply ?? "";
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            mode: "capture",
            text: data.reply,
            source: data.source,
            provider: data.provider,
            steps: data.steps,
            suggestion: data.suggestion,
            emailDraft: data.emailDraft,
          },
        ]);
        if (data.mutated) router.refresh();
      }
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Couldn't reach the server. Try again.", source: "local" }]);
    } finally {
      setLoading(false);
    }
    return replyText;
  }

  // Keep a stable handle to the latest send() so the voice loop (whose callbacks
  // are captured at recognition-creation time) always uses fresh conversation
  // history without re-binding the whole loop each render.
  sendRef.current = send;

  // ---- hands-free conversation loop ----------------------------------------
  function beginListen() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !voiceOnRef.current) return;
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    recErrorRef.current = false;
    setVoiceState("listening");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = () => {
      recErrorRef.current = true;
    };
    rec.onend = () => {
      const text = finalRef.current.trim();
      setInput("");
      if (!voiceOnRef.current) {
        setVoiceState("idle");
        return;
      }
      // A recognition error (e.g. mic permission denied) — stop rather than spin.
      if (recErrorRef.current && !text) {
        stopConversation();
        return;
      }
      if (text) {
        void voiceTurn(text);
      } else {
        // Silence timeout — keep the ear open for the next thing they say.
        setTimeout(() => beginListen(), 300);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setTimeout(() => beginListen(), 400);
    }
  }

  async function voiceTurn(text: string) {
    setVoiceState("thinking");
    const reply = await sendRef.current(text);
    if (!voiceOnRef.current) {
      setVoiceState("idle");
      return;
    }
    if (reply && voiceOutSupported()) {
      setVoiceState("speaking");
      speak(reply, () => {
        if (voiceOnRef.current) beginListen();
        else setVoiceState("idle");
      });
    } else {
      beginListen();
    }
  }

  function startConversation() {
    if (!voiceSupported) return;
    changeMode("wonder");
    voiceOnRef.current = true;
    setVoiceOn(true);
    setOpen(true);
    beginListen();
  }

  function stopConversation() {
    voiceOnRef.current = false;
    setVoiceOn(false);
    setVoiceState("idle");
    try {
      recRef.current?.abort?.();
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    stopSpeaking();
    setInput("");
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

  // New thread: fold the current conversation into the rolling memory (so the
  // next thread remembers the gist), then clear the transcript.
  async function newChat() {
    if (loading) return;
    const hasContent = messages.some((m) => m.role === "ai");
    if (!hasContent) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "summarize",
          messages: messages.map((m) => ({ role: m.role, text: m.text })),
          memory,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.text) setMemory(data.text);
    } catch {
      /* keep existing memory */
    } finally {
      setMessages([]);
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
                      {voiceOn ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                          {voiceState === "listening"
                            ? "listening…"
                            : voiceState === "thinking"
                              ? "thinking…"
                              : voiceState === "speaking"
                                ? "speaking…"
                                : "voice mode"}
                        </>
                      ) : lastAi ? (
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
                <div className="flex items-center gap-1">
                  {voiceSupported && (
                    <button
                      onClick={() => (voiceOn ? stopConversation() : startConversation())}
                      className={cn(
                        "press relative grid h-9 w-9 place-items-center rounded-full transition-colors",
                        voiceOn ? "bg-rose-500/90 text-white" : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
                      )}
                      aria-label={voiceOn ? "End voice conversation" : "Start voice conversation"}
                      aria-pressed={voiceOn}
                      title={voiceOn ? "End voice conversation" : "Talk hands-free"}
                    >
                      {voiceOn && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />}
                      <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {voiceOn ? (
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        ) : (
                          <>
                            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </>
                        )}
                      </svg>
                    </button>
                  )}
                  {messages.length > 0 && (
                    <button
                      onClick={newChat}
                      className="press grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                      aria-label="New chat"
                      title="New chat (keeps a memory of this one)"
                    >
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="press grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
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
              <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5">
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
                    {memory && (
                      <p className="mx-auto mt-3 max-w-sm text-xs text-violet-300/70">
                        🧵 Fresh thread — I still remember the gist of our past chats.
                      </p>
                    )}
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
                    {m.images && m.images.length > 0 && (
                      <div className={cn("mb-2 flex flex-wrap gap-1.5", m.role === "you" && "justify-end")}>
                        {m.images.map((src, k) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={k} src={src} alt="attachment" className="h-20 w-20 rounded-xl object-cover" />
                        ))}
                      </div>
                    )}

                    {m.role === "you" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-zinc-800/90 px-4 py-2.5 text-[15px] text-zinc-100 [overflow-wrap:anywhere]">
                          {m.text}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className="text-[15px] leading-relaxed text-zinc-100">
                          <Markdown>{m.text}</Markdown>
                        </div>

                        {m.steps && m.steps.some((s) => WRITE_TOOLS.has(s.tool)) && (
                          <div className="mt-3 flex flex-col gap-1.5">
                            {m.steps
                              .filter((s) => WRITE_TOOLS.has(s.tool))
                              .map((s, j) => (
                                <ActionCard key={j} step={s} onNavigate={() => setOpen(false)} />
                              ))}
                          </div>
                        )}

                        {m.suggestion && <SuggestionCard suggestion={m.suggestion} onAdded={() => router.refresh()} />}

                        {m.emailDraft && <EmailDraftCard draft={m.emailDraft} />}

                        {m.source === "ai" && (
                          <MessageActions
                            text={m.text}
                            canSave={m.mode === "wonder"}
                            saved={m.saved}
                            saveDisabled={loading}
                            onSave={() => saveThis(i)}
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {loading && !streaming && (
                  <div className="flex justify-start py-1">
                    <span className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                    </span>
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
              <div className="mx-auto w-full max-w-2xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                {images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {images.map((src, k) => (
                      <div key={k} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="attachment" className="h-14 w-14 rounded-xl object-cover" />
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
                {/* One unified pill: attach · input · mic · send */}
                <div className="flex items-end gap-1 rounded-[1.7rem] border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-2 focus-within:border-white/20">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setAttachOpen((v) => !v)}
                      aria-label="Add a photo"
                      className="press grid h-9 w-9 place-items-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={cn("h-5 w-5 transition-transform", attachOpen && "rotate-45")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    {attachOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAttachOpen(false)} />
                        <div className="absolute bottom-11 left-0 z-20 w-44 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              cameraRef.current?.click();
                              setAttachOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            Take photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              galleryRef.current?.click();
                              setAttachOpen(false);
                            }}
                            className="flex w-full items-center gap-3 border-t border-white/5 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                            Photo library
                          </button>
                        </div>
                      </>
                    )}
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        addImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={galleryRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <textarea
                    ref={taRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // On desktop, Enter sends (Shift+Enter = newline). On touch
                      // keyboards Enter inserts a newline; use the send button.
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
                    placeholder={mode === "wonder" ? "Think out loud…" : "Capture anything, or paste a note…"}
                    className="max-h-40 min-h-[2.25rem] flex-1 resize-none self-center overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
                  />
                  <MicButton value={input} onChange={setInput} className="h-9 w-9 shrink-0" />
                  <button
                    type="submit"
                    disabled={loading || (!input.trim() && images.length === 0)}
                    className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-zinc-900 transition-opacity disabled:bg-white/20 disabled:text-zinc-500"
                    aria-label="Send"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SuggestionCard({ suggestion, onAdded }: { suggestion: Suggestion; onAdded: () => void }) {
  const [state, setState] = useState<"idle" | "adding" | "added" | "dismissed">("idle");
  if (state === "dismissed") return null;

  async function add() {
    setState("adding");
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestion.title,
          due: suggestion.due,
          sourceType: suggestion.sourceType,
          sourceId: suggestion.sourceId,
          tz: new Date().getTimezoneOffset(),
        }),
      });
      if (!res.ok) throw new Error();
      setState("added");
      onAdded();
    } catch {
      setState("idle");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-500/5 p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-base">🎯</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-violet-300">Suggested follow-through</div>
          <div className="text-sm text-zinc-200">
            {suggestion.title} <span className="text-zinc-500">· {suggestion.due}</span>
          </div>
          {state === "added" ? (
            <div className="mt-1 text-xs text-emerald-300">✓ Added to commitments</div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                onClick={add}
                disabled={state === "adding"}
                className="press rounded-lg bg-violet-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
              >
                ＋ Add reminder
              </button>
              <button
                onClick={() => setState("dismissed")}
                className="press rounded-lg px-3 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              >
                No thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailDraftCard({ draft }: { draft: EmailDraft }) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "dismissed">("idle");
  const [error, setError] = useState("");

  if (state === "dismissed") return null;

  async function sendIt() {
    if (!to.trim() || !body.trim() || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
        ✓ Sent to {to}
      </div>
    );
  }

  const field = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none";

  return (
    <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-sky-300">📧 Draft email · review &amp; send</div>
      <div className="space-y-2">
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@email.com" className={field} />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={field} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={`${field} resize-y leading-relaxed`} />
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={sendIt}
          disabled={state === "sending" || !to.trim() || !body.trim()}
          className="press rounded-lg bg-sky-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => setState("dismissed")}
          className="press rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function MessageActions({
  text,
  canSave,
  saved,
  saveDisabled,
  onSave,
}: {
  text: string;
  canSave: boolean;
  saved?: boolean;
  saveDisabled: boolean;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <div className="mt-2 flex items-center gap-0.5 text-zinc-500">
      <IconButton label={copied ? "Copied" : "Copy"} onClick={copy} active={copied}>
        {copied ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </IconButton>
      <IconButton label={speaking ? "Stop" : "Read aloud"} onClick={speak} active={speaking}>
        {speaking ? (
          <>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </>
        ) : (
          <>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a9 9 0 0 1 0 14" />
          </>
        )}
      </IconButton>
      {canSave &&
        (saved ? (
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-emerald-300">✓ saved</span>
        ) : (
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className="press ml-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
          >
            ✦ Save this
          </button>
        ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "press grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-white/10 hover:text-zinc-200",
        active && "text-emerald-300",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function ActionCard({ step, onNavigate }: { step: Step; onNavigate: () => void }) {
  const isCommitment = step.tool === "create_commitment";
  const isCalendar = step.tool === "create_calendar_event";
  const icon = isCalendar ? "📅" : isCommitment ? "🎯" : step.entryType ? TYPES[step.entryType as EntryType]?.icon : "🔗";
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
      {((step.entryId && step.ok) || (isCommitment && step.ok)) && (
        <span className="shrink-0 text-xs text-zinc-500">open →</span>
      )}
    </div>
  );

  if (step.ok && (step.entryId || isCommitment)) {
    return (
      <Link
        href={isCommitment ? "/commitments" : `/entry/${step.entryId}`}
        onClick={onNavigate}
        className="press block"
      >
        {body}
      </Link>
    );
  }
  return body;
}
