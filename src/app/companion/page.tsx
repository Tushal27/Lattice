"use client";

import { useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Msg {
  role: "you" | "partner";
  text: string;
  source?: "ai" | "local";
}

const PROMPTS = [
  "What patterns do you see in my recent decisions?",
  "What should I be reflecting on right now?",
  "Challenge an assumption I seem to be making.",
];

export default function CompanionPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    const text = message.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "you", text }]);
    setInput("");
    setLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "ask", message: text }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: "partner", text: data.text, source: data.source }]);
    setLoading(false);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col animate-[fadeUp_0.4s_ease-out] md:h-[calc(100vh-5rem)]">
      <PageHeader
        icon="🤝"
        accentColor="sky"
        title="Thinking Partner"
        subtitle="Not an answer machine — a partner that helps you think better."
      />

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <p className="text-zinc-300">
              I can see your decisions, lessons, questions, and projects. Ask me to find patterns, connect ideas, or
              push back on your thinking.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-sky-500/50 hover:text-sky-200"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "you" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.role === "you"
                  ? "bg-violet-600 text-white"
                  : "border border-zinc-800 bg-zinc-900/60 text-zinc-200",
              )}
            >
              {m.role === "partner" ? <Markdown>{m.text}</Markdown> : m.text}
              {m.source === "local" && (
                <p className="mt-2 text-xs text-zinc-500">Add GEMINI_API_KEY to enable the AI partner.</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your thinking partner…"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
