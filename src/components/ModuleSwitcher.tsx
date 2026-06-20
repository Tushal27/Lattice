import Link from "next/link";
import { MODULES } from "@/lib/types";
import { cn } from "@/lib/utils";

// Switches the dashboard lens between "All" and each module (one shared brain —
// this scopes the view, it doesn't silo the data).
export function ModuleSwitcher({ active }: { active: string }) {
  const items = [{ id: "all", name: "All", icon: "✶" }, ...MODULES.map((m) => ({ id: m.id, name: m.name, icon: m.icon }))];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = active === it.id;
        return (
          <Link
            key={it.id}
            href={it.id === "all" ? "/" : `/?module=${it.id}`}
            className={cn(
              "press rounded-full border px-3 py-1.5 text-sm transition-colors",
              on
                ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            )}
          >
            <span className="mr-1">{it.icon}</span>
            {it.name}
          </Link>
        );
      })}
    </div>
  );
}
