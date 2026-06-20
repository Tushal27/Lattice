"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TYPE_LIST } from "@/lib/types";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/", label: "Dashboard", icon: "◇" },
  { href: "/review", label: "Daily Review", icon: "☀️" },
];

const areas = TYPE_LIST.map((t) => ({
  href: `/${t.slug}`,
  label: t.plural,
  icon: t.icon,
}));

const discover = [
  { href: "/learn", label: "Test Me", icon: "🎯" },
  { href: "/graph", label: "Knowledge Graph", icon: "🕸️" },
  { href: "/timeline", label: "Life Timeline", icon: "🧭" },
  { href: "/patterns", label: "Patterns", icon: "📊" },
  { href: "/reflect", label: "Reflections", icon: "🔮" },
];

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-zinc-800/80 text-zinc-50" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200",
      )}
    >
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function openCommand() {
  window.dispatchEvent(new CustomEvent("lattice:command"));
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950/40 p-4 md:flex md:flex-col">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white">
          ⌘
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-zinc-100">Lattice</div>
          <div className="text-[11px] text-zinc-500">your personal OS</div>
        </div>
      </Link>

      <Link
        href="/capture"
        className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        <span className="text-base leading-none">＋</span> Capture
      </Link>

      <button
        onClick={openCommand}
        className="mb-6 flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
      >
        <span className="flex items-center gap-2">
          <span>🔍</span> Quick find
        </span>
        <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {primary.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
        <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Areas</div>
        {areas.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
        <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Discover</div>
        {discover.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("lattice:open-chat", { detail: { mode: "wonder" } }))}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200"
        >
          <span className="w-5 text-center text-base leading-none">🧠</span>
          <span>Thinking Partner</span>
        </button>
      </nav>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("lattice:open-guide"))}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200"
      >
        <span className="w-5 text-center text-base leading-none">❓</span>
        <span>How to use</span>
      </button>
      <div className="mt-2 px-3 text-[11px] text-zinc-600">Every lesson compounds.</div>
    </aside>
  );
}
