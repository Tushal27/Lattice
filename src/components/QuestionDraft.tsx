"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/Toast";

// The AI draft answer to an open question — refine it inline or accept it,
// without leaving the page (so the draft never disappears into the edit form).
export function QuestionDraft({ entryId, initial, accepted: initialAccepted }: { entryId: string; initial: string; accepted: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [text, setText] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [accepted, setAccepted] = useState(initialAccepted);
  const [busy, setBusy] = useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/entries/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entryId, ...payload }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      toast("Couldn't save", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (await post({ set: { aiDraft: text } })) {
      setDraft(text);
      setEditing(false);
      toast("Saved");
    }
  }

  async function accept() {
    if (await post({ status: "answered", set: { aiDraftAccepted: "1" } })) {
      setAccepted(true);
      toast("Marked as answered");
      router.refresh();
    }
  }

  const tone = accepted ? "border-emerald-500/25 from-emerald-500/10" : "border-violet-500/25 from-violet-500/10";

  return (
    <div className={`mb-6 rounded-xl border bg-gradient-to-b to-transparent p-4 ${tone}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`flex items-center gap-2 text-sm font-semibold ${accepted ? "text-emerald-200" : "text-violet-200"}`}>
          {accepted ? "✓ Answer" : "✦ Draft answer"}
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">
            {accepted ? "accepted" : "AI · review & refine"}
          </span>
        </span>
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          autoFocus
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] p-3 text-[15px] leading-relaxed text-zinc-100 focus:border-violet-400/40 focus:outline-none"
        />
      ) : (
        <div className="text-[15px] leading-relaxed text-zinc-200">
          <Markdown>{draft}</Markdown>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button onClick={save} disabled={busy} className="press rounded-lg bg-violet-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setText(draft); setEditing(false); }} className="press rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="press rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">
              ✏️ Refine
            </button>
            {!accepted && (
              <button onClick={accept} disabled={busy} className="press rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
                ✓ Accept as answer
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
