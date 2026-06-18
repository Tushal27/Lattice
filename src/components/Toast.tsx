"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const EVENT = "lattice:toast";

/** Fire a toast from anywhere on the client. */
export function toast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, type } }));
}

const ICON: Record<ToastType, string> = { success: "✓", error: "✕", info: "ℹ" };
const STYLE: Record<ToastType, string> = {
  success: "border-emerald-500/40 text-emerald-200",
  error: "border-rose-500/40 text-rose-200",
  info: "border-sky-500/40 text-sky-200",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let id = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const item = { id: ++id, message: detail.message, type: detail.type };
      setItems((prev) => [...prev, item]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), 3200);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-xl border bg-zinc-900/90 px-4 py-2.5 text-sm shadow-lg backdrop-blur animate-[fadeUp_0.25s_ease-out]",
            STYLE[t.type],
          )}
        >
          <span className="font-bold">{ICON[t.type]}</span>
          <span className="text-zinc-100">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
