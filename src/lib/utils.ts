export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function parseFields(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  const mon = Math.round(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.round(mon / 12)}y ago`;
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/** Tailwind needs literal class names, so map accent families explicitly. */
export const ACCENT: Record<string, { text: string; bg: string; border: string; dot: string; ring: string }> = {
  amber: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400", ring: "focus:ring-amber-500/40" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400", ring: "focus:ring-emerald-500/40" },
  fuchsia: { text: "text-fuchsia-300", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", dot: "bg-fuchsia-400", ring: "focus:ring-fuchsia-500/40" },
  sky: { text: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/30", dot: "bg-sky-400", ring: "focus:ring-sky-500/40" },
  violet: { text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30", dot: "bg-violet-400", ring: "focus:ring-violet-500/40" },
  rose: { text: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-400", ring: "focus:ring-rose-500/40" },
  cyan: { text: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400", ring: "focus:ring-cyan-500/40" },
  orange: { text: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400", ring: "focus:ring-orange-500/40" },
  lime: { text: "text-lime-300", bg: "bg-lime-500/10", border: "border-lime-500/30", dot: "bg-lime-400", ring: "focus:ring-lime-500/40" },
};

export function accent(name: string) {
  return ACCENT[name] ?? ACCENT.violet;
}
