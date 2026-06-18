"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { TypeBadge } from "@/components/ui";
import { TYPES, type EntryType } from "@/lib/types";
import { accent, cn, relativeTime, truncate } from "@/lib/utils";

export interface EntryCardData {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  status: string | null;
  confidence: number | null;
  createdAt: Date | string;
  tags?: { tag: { name: string } }[];
}

export function EntryCard({ entry }: { entry: EntryCardData }) {
  const cfg = TYPES[entry.type as EntryType];
  const a = accent(cfg?.accent ?? "violet");

  return (
    <Link href={`/entry/${entry.id}`} className="group block">
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="ring-gradient relative h-full overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm transition-colors group-hover:bg-white/[0.06]"
      >
        {/* accent glow that blooms on hover */}
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
            a.dot,
          )}
        />
        <div className="relative">
          <div className="mb-2 flex items-center justify-between gap-2">
            <TypeBadge type={entry.type} />
            <span className="text-[11px] text-zinc-500">{relativeTime(entry.createdAt)}</span>
          </div>
          <h3 className="font-medium leading-snug text-zinc-100 group-hover:text-white">{entry.title}</h3>
          {entry.summary && <p className="mt-1 text-sm text-zinc-400">{truncate(entry.summary, 140)}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            {entry.status && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-300">{entry.status}</span>
            )}
            {typeof entry.confidence === "number" && (
              <span className={a.text}>confidence {entry.confidence}%</span>
            )}
            {entry.tags && entry.tags.length > 0 && (
              <span className="text-zinc-500">{entry.tags.map((t) => `#${t.tag.name}`).join(" ")}</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
