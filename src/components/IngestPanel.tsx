"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

// Capture knowledge from outside Lattice: paste a link (article, page, repo) or
// drop in a text/markdown file. Both distill into a structured entry.
export function IngestPanel() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; type?: string; skipped?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function captureUrl() {
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't capture that link");
      setResult({ title: data.title, type: data.type, skipped: data.skipped });
      setUrl("");
      toast(data.skipped ? "Already captured" : "Captured from web");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function captureFile(file: File) {
    if (busy) return;
    // Read text client-side — keeps the server free of file-parsing deps.
    const text = await file.text().catch(() => "");
    if (!text.trim()) {
      toast("Couldn't read that file (text/markdown only)", "error");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ingest/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: file.name, text: text.slice(0, 200000) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't ingest that file");
      setResult({ title: data.title, type: data.type });
      toast("Captured from file");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">📥 Capture from anywhere</h3>
      <p className="mt-1 text-sm text-zinc-500">Paste a link, or drop in a text/markdown file — I&apos;ll distill it into a note.</p>

      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") captureUrl();
          }}
          placeholder="https://an-article-or-repo…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
        />
        <button
          onClick={captureUrl}
          disabled={busy || !url.trim()}
          className="press shrink-0 rounded-lg bg-violet-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {busy ? "…" : "Capture"}
        </button>
      </div>

      <div className="mt-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="press rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
        >
          📄 Upload a text / markdown file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,.json,.log,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) captureFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {result && (
        <p className="mt-3 text-sm text-emerald-200/80">
          {result.skipped ? "Already had: " : "✓ Captured: "}
          <span className="text-zinc-200">{result.title}</span>
          {result.type && <span className="text-zinc-500"> · {result.type}</span>}
        </p>
      )}
    </div>
  );
}
