"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

// One-click web capture from any browser: drag this link to the bookmarks bar.
// Clicking it on any page opens Lattice's /ingest with the current URL, which
// captures it same-origin (no extension, no CORS).
export function BookmarkletCard() {
  const [href, setHref] = useState("");

  useEffect(() => {
    const origin = window.location.origin;
    // Keep it tiny and self-contained. window.location is client-only, so this
    // one-time setState in an effect is intentional.
    const code = `javascript:(function(){window.open('${origin}/ingest?url='+encodeURIComponent(location.href),'_blank');})();`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(code);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      toast("Bookmarklet copied");
    } catch {
      toast("Couldn't copy", "error");
    }
  }

  if (!href) return null;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">⭐ Save to Lattice (bookmarklet)</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Drag this button to your bookmarks bar. On any page, click it to capture the link into Lattice.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={href}
          onClick={(e) => e.preventDefault()}
          draggable
          className="press cursor-grab rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-2 text-sm font-medium text-white active:cursor-grabbing"
        >
          ⭐ Save to Lattice
        </a>
        <button
          onClick={copy}
          className="press rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
        >
          Copy code
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">Tip: on mobile, use the system Share sheet → Lattice instead.</p>
    </div>
  );
}
