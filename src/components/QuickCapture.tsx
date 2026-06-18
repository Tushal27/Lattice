"use client";

import { useState } from "react";
import { EntryForm } from "@/components/EntryForm";
import { TYPE_LIST, TYPES, isEntryType, type EntryType } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

interface Classified {
  type: EntryType;
  title: string;
  summary: string;
  tags: string[];
  source: "ai" | "local";
}

export function QuickCapture({ projects }: { projects: { id: string; title: string }[] }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Classified | null>(null);

  async function sort() {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "classify", text }),
    });
    const data = await res.json();
    setLoading(false);
    if (data && isEntryType(data.type)) {
      setResult({
        type: data.type,
        title: data.title ?? "",
        summary: data.summary ?? "",
        tags: data.tags ?? [],
        source: data.source,
      });
    }
  }

  if (result) {
    const cfg = TYPES[result.type];
    const a = accent(cfg.accent);
    return (
      <div className="space-y-5">
        <div className={cn("rounded-xl border p-4", a.bg, a.border)}>
          <p className="text-sm text-zinc-300">
            {result.source === "ai" ? "✨ Sorted this as a" : "Looks like a"}{" "}
            <span className={cn("font-semibold", a.text)}>{cfg.label}</span>. Adjust anything, then save.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TYPE_LIST.map((t) => (
              <button
                key={t.type}
                onClick={() => setResult({ ...result, type: t.type })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  t.type === result.type
                    ? cn(accent(t.accent).bg, accent(t.accent).border, accent(t.accent).text)
                    : "border-zinc-700 text-zinc-400 hover:text-zinc-200",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <EntryForm
          key={result.type}
          type={result.type}
          projects={projects}
          defaultValues={{ title: result.title, summary: result.summary }}
          defaultTags={result.tags}
        />

        <button onClick={() => setResult(null)} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← start over
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sort();
          }}
          rows={4}
          autoFocus
          placeholder="Dump a raw thought — a decision you made, something you learned, a question, an idea… I'll sort it into the right place."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-zinc-100 placeholder:text-zinc-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-600">⌘/Ctrl + Enter</span>
        <button
          onClick={sort}
          disabled={!text.trim() || loading}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sorting…" : "✨ Sort it for me"}
        </button>
      </div>
    </div>
  );
}
