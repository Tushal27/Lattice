"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: "◇" },
  { href: "/review", label: "Review", icon: "☀️" },
  { href: "/graph", label: "Graph", icon: "🕸️" },
];

function openCommand() {
  window.dispatchEvent(new CustomEvent("lattice:command"));
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Slim top header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-sky-500 text-xs font-bold text-white">
            ⌘
          </span>
          <span className="text-sm font-semibold">Lattice</span>
        </Link>
        <button
          onClick={openCommand}
          className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400"
        >
          🔍 Find
        </button>
      </header>

      {/* Bottom tab bar with central capture button */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          <TabLink {...tabs[0]} active={isActive(tabs[0].href)} />
          <TabLink {...tabs[1]} active={isActive(tabs[1].href)} />

          <button
            onClick={() => router.push("/capture")}
            className="-mt-6 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-sky-600 text-2xl text-white shadow-lg shadow-violet-900/40 ring-4 ring-zinc-950"
            aria-label="Capture"
          >
            ＋
          </button>

          <TabLink {...tabs[2]} active={isActive(tabs[2].href)} />
          <button
            onClick={openCommand}
            className="flex w-16 flex-col items-center gap-0.5 py-2 text-zinc-500"
          >
            <span className="text-lg leading-none">🔍</span>
            <span className="text-[10px]">Find</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn("flex w-16 flex-col items-center gap-0.5 py-2", active ? "text-zinc-50" : "text-zinc-500")}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </Link>
  );
}
