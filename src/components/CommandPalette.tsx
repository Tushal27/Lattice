"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TYPE_LIST } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
  keywords?: string;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Global hotkey: ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") close();
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("lattice:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lattice:command", onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Debounced search. All state updates happen inside the async callback, never
  // synchronously in the effect body.
  useEffect(() => {
    const term = query.trim();
    const t = setTimeout(async () => {
      if (!term) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        setResults(await res.json());
        setActive(0);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const actions: Item[] = [
    { id: "qc", label: "Quick capture a thought", hint: "AI sorts it", icon: "✨", run: () => go("/capture"), keywords: "new add" },
    ...TYPE_LIST.map((t) => ({
      id: `new-${t.type}`,
      label: `New ${t.label}`,
      icon: t.icon,
      run: () => go(`/capture?type=${t.type}`),
      keywords: `capture create ${t.plural}`,
    })),
    { id: "nav-home", label: "Dashboard", icon: "◇", run: () => go("/"), keywords: "home" },
    { id: "nav-learn", label: "Test Me", icon: "🎯", run: () => go("/learn"), keywords: "recall quiz flashcards learn study" },
    { id: "nav-graph", label: "Knowledge Graph", icon: "🕸️", run: () => go("/graph"), keywords: "network connections lattice" },
    { id: "nav-review", label: "Daily Review", icon: "☀️", run: () => go("/review"), keywords: "resurface on this day" },
    { id: "nav-commitments", label: "Commitments", icon: "🎯", run: () => go("/commitments"), keywords: "reminders tasks follow through habits due" },
    { id: "nav-money", label: "Money Review", icon: "💰", run: () => go("/money"), keywords: "finance spending expenses roi budget investment worth it" },
    { id: "nav-patterns", label: "Patterns", icon: "📊", run: () => go("/patterns"), keywords: "insights trends calibration" },
    { id: "nav-reflect", label: "Reflections", icon: "🔮", run: () => go("/reflect"), keywords: "weekly monthly" },
    {
      id: "nav-companion",
      label: "Thinking Partner",
      icon: "🧠",
      run: () => {
        close();
        window.dispatchEvent(new CustomEvent("lattice:open-chat", { detail: { mode: "wonder" } }));
      },
      keywords: "ai chat wonder partner",
    },
    { id: "nav-timeline", label: "Life Timeline", icon: "🧭", run: () => go("/timeline"), keywords: "history" },
    {
      id: "help",
      label: "How to use Lattice",
      icon: "❓",
      run: () => {
        close();
        window.dispatchEvent(new CustomEvent("lattice:open-guide"));
      },
      keywords: "help guide onboarding tutorial",
    },
  ];

  const q = query.trim().toLowerCase();
  const filteredActions = q
    ? actions.filter((a) => (a.label + " " + (a.keywords ?? "")).toLowerCase().includes(q))
    : actions;

  const resultItems: Item[] = results.map((r) => ({
    id: `r-${r.id}`,
    label: r.title,
    hint: r.type,
    icon: TYPE_LIST.find((t) => t.type === r.type)?.icon ?? "•",
    run: () => go(`/entry/${r.id}`),
  }));

  const searchAction: Item[] = q
    ? [{ id: "search-all", label: `Search for “${query}”`, icon: "🔍", run: () => go(`/search?q=${encodeURIComponent(query)}`) }]
    : [];

  const flat = [...filteredActions, ...resultItems, ...searchAction];
  // `active` can be stale after async results arrive; clamp it at use time.
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;
  const resultOffset = filteredActions.length;
  const searchOffset = filteredActions.length + resultItems.length;

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.run();
    }
  }

  const renderItem = (item: Item, i: number) => (
    <button
      key={item.id}
      onMouseEnter={() => setActive(i)}
      onClick={item.run}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
        i === activeIndex ? "bg-zinc-800 text-zinc-50" : "text-zinc-300",
      )}
    >
      <span className="w-5 text-center text-base">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.hint && <span className="text-xs text-zinc-500 capitalize">{item.hint}</span>}
    </button>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/95 shadow-2xl animate-[fadeUp_0.2s_ease-out]"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <span className="text-zinc-500">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search or jump to…"
            className="w-full bg-transparent py-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">No matches.</p>
          ) : (
            <>
              {filteredActions.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Actions</p>
                  {filteredActions.map((item, i) => renderItem(item, i))}
                </>
              )}
              {resultItems.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Entries</p>
                  {resultItems.map((item, i) => renderItem(item, resultOffset + i))}
                </>
              )}
              {searchAction.map((item, i) => renderItem(item, searchOffset + i))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
