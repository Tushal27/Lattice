"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

interface Fact {
  id: string;
  content: string;
  weight: number;
}

// What the assistant durably knows about you — editable, transparent, and shared
// across devices.
export function MemoryCard() {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [memory, setMemory] = useState("");
  const [adding, setAdding] = useState("");

  async function load() {
    try {
      const d = await (await fetch("/api/memory")).json();
      setFacts(d.facts ?? []);
      setMemory(d.memory ?? "");
    } catch {
      setFacts([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await (await fetch("/api/memory")).json();
        if (cancelled) return;
        setFacts(d.facts ?? []);
        setMemory(d.memory ?? "");
      } catch {
        if (!cancelled) setFacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function add() {
    const content = adding.trim();
    if (!content) return;
    setAdding("");
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact: content }),
    });
    toast("Added to memory");
    load();
  }

  async function remove(id: string) {
    setFacts((f) => f?.filter((x) => x.id !== id) ?? f);
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  if (!facts) return null;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">🧠 What I remember about you</h3>
      <p className="mt-1 text-sm text-zinc-500">Durable facts the assistant keeps in mind. Shared across your devices.</p>

      <div className="mt-3 flex gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Add something I should always remember…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
        />
        <button
          onClick={add}
          disabled={!adding.trim()}
          className="press shrink-0 rounded-lg bg-violet-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {facts.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">Nothing yet — facts build up as we chat, or add your own above.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {facts.map((f) => (
            <li
              key={f.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-zinc-200"
            >
              {f.content}
              <button
                onClick={() => remove(f.id)}
                className="text-zinc-600 hover:text-rose-300"
                aria-label="Forget this"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {memory && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Rolling chat memory</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{memory}</p>
        </details>
      )}
    </div>
  );
}
