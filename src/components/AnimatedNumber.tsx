"use client";

import { useEffect, useState } from "react";

/** Eases a number up from 0 to `value` on mount — a small touch that makes
 *  stat dashboards feel alive. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{n}</span>;
}
