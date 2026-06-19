"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
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
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 md:hidden">
        <Link href="/" className="press flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-sky-500 text-xs font-bold text-white">
            ⌘
          </span>
          <span className="text-sm font-semibold tracking-tight">Lattice</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("lattice:open-guide"))}
            aria-label="How to use Lattice"
            className="press grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-sm text-zinc-400"
          >
            ?
          </button>
          <button
            onClick={openCommand}
            className="press flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-400"
          >
            🔍 Find
          </button>
        </div>
      </header>

      {/* Bottom tab bar with central capture button */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 md:hidden">
        <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1">
          <TabLink {...tabs[0]} active={isActive(tabs[0].href)} />
          <TabLink {...tabs[1]} active={isActive(tabs[1].href)} />

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => router.push("/capture")}
            className="glow-violet -mt-6 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-sky-600 text-2xl text-white ring-4 ring-[#07070a]"
            aria-label="Capture"
          >
            ＋
          </motion.button>

          <TabLink {...tabs[2]} active={isActive(tabs[2].href)} />
          <button onClick={openCommand} className="press flex w-16 flex-col items-center gap-0.5 py-2 text-zinc-500">
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
      className={cn(
        "relative flex w-16 flex-col items-center gap-0.5 py-2 transition-colors",
        active ? "text-zinc-50" : "text-zinc-500",
      )}
    >
      {active && (
        <motion.span
          layoutId="tabGlow"
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className="absolute -top-1 h-1 w-8 rounded-full bg-gradient-to-r from-violet-400 to-sky-400"
        />
      )}
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </Link>
  );
}
