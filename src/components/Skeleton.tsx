import { cn } from "@/lib/utils";

/** A shimmering placeholder block. Compose these to mirror a page's layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
