"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MODULES, typesForModule } from "@/lib/types";
import { cn } from "@/lib/utils";

// Module scope is a client-side VIEW filter (instant), not a navigation — so
// switching All ↔ Personal ↔ Engineering never re-runs the server dashboard.
const KEY = "lattice:module";

interface Scope {
  active: string;
  setActive: (id: string) => void;
}
const Ctx = createContext<Scope>({ active: "all", setActive: () => {} });

export function useModuleScope() {
  return useContext(Ctx);
}

/** Set of entry-type keys for a module ("all" → every type). */
export function moduleTypeKeys(active: string): Set<string> {
  return new Set(typesForModule(active).map((t) => t.type));
}

export function ModuleScopeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setActiveState(saved);
    } catch {}
  }, []);

  const setActive = (id: string) => {
    setActiveState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  };

  return <Ctx.Provider value={{ active, setActive }}>{children}</Ctx.Provider>;
}

export function ModuleSwitcher() {
  const { active, setActive } = useModuleScope();
  const items = [{ id: "all", name: "All", icon: "✶" }, ...MODULES.map((m) => ({ id: m.id, name: m.name, icon: m.icon }))];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setActive(it.id)}
            className={cn(
              "press rounded-full border px-3 py-1.5 text-sm transition-colors",
              on
                ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            )}
          >
            <span className="mr-1">{it.icon}</span>
            {it.name}
          </button>
        );
      })}
    </div>
  );
}
