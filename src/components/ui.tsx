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
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-zinc-50">
          {icon && (
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-xl", a?.bg)}>{icon}</span>
          )}
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div className="mb-3 text-4xl opacity-60">{icon}</div>
      <p className="text-zinc-300">{title}</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5", className)}>{children}</div>
  );
}
