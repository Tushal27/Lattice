import Link from "next/link";
import { TYPES, type EntryType } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

export function TypeBadge({ type, size = "sm" }: { type: string; size?: "sm" | "xs" }) {
  const cfg = TYPES[type as EntryType];
  if (!cfg) return null;
  const a = accent(cfg.accent);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        a.bg,
        a.border,
        a.text,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
      )}
    >
      <span aria-hidden>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

export function TagChip({ name }: { name: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(name)}`}
      className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
    >
      #{name}
    </Link>
  );
}

export function PageHeader({
  icon,
  title,
  subtitle,
  accentColor,
  action,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  action?: React.ReactNode;
}) {
  const a = accentColor ? accent(accentColor) : null;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-zinc-50">
          {icon && (
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-xl",
                a?.bg,
                a?.border ?? "border-white/10",
              )}
            >
              {icon}
            </span>
          )}
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ring-gradient relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="relative">
        <div className="mx-auto mb-4 grid h-16 w-16 animate-[pop_0.4s_ease-out] place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl">
          {icon}
        </div>
        <p className="text-base font-medium text-zinc-200">{title}</p>
        {hint && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">{hint}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("elev rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5", className)}>{children}</div>
  );
}
