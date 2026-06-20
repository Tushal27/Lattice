"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { TYPE_LIST, type TypeConfig } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

export function StatGrid({ counts, types = TYPE_LIST }: { counts: Record<string, number>; types?: TypeConfig[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {types.map((t) => {
        const a = accent(t.accent);
        const count = counts[t.type] ?? 0;
        return (
          <motion.div
            key={t.type}
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <Link href={`/area/${t.slug}`} className="group block">
              <motion.div
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                className="ring-gradient relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-60",
                    a.dot,
                  )}
                />
                <div className={cn("absolute inset-x-0 top-0 h-0.5", a.dot)} />
                <div className="relative">
                  <div className="mb-2 text-2xl">{t.icon}</div>
                  <AnimatedNumber value={count} className="text-2xl font-semibold text-zinc-50" />
                  <div className="text-xs text-zinc-500">{t.plural}</div>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
