"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative"
    >
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search everything — decisions, lessons, ideas, questions…"
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 py-3 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      />
    </form>
  );
}
