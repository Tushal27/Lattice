"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TYPE_LIST } from "@/lib/types";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: "◇" },
  ...TYPE_LIST.map((t) => ({ href: `/${t.slug}`, label: t.label, icon: t.icon })),
  { href: "/reflect", label: "Reflect", icon: "🔮" },
  { href: "/search", label: "Search", icon: "🔍" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-sky-500 text-xs font-bold text-white">
            ⌘
          </span>
          <span className="text-sm font-semibold">Lattice</span>
        </Link>
        <Link href="/capture" className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white">
          ＋ Capture
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs",
                active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400",
              )}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
