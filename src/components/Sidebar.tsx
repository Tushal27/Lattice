"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TYPE_LIST } from "@/lib/types";
import { cn } from "@/lib/utils";

const primary = [{ href: "/", label: "Dashboard", icon: "◇" }];

const areas = TYPE_LIST.map((t) => ({
  href: `/${t.slug}`,
  label: t.plural,
  icon: t.icon,
}));

const reflectNav = [
  { href: "/timeline", label: "Life Timeline", icon: "🧭" },
  { href: "/reflect", label: "Reflections", icon: "🔮" },
  { href: "/companion", label: "Thinking Partner", icon: "🤝" },
  { href: "/search", label: "Search", icon: "🔍" },
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
        className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        <span className="text-base leading-none">＋</span> Capture
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {primary.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
        <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          Areas
        </div>
        {areas.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
        <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          Reflect
        </div>
        {reflectNav.map((n) => (
          <NavLink key={n.href} {...n} />
        ))}
      </nav>

      <div className="mt-4 px-3 text-[11px] text-zinc-600">
        Every lesson compounds.
      </div>
    </aside>
  );
}
