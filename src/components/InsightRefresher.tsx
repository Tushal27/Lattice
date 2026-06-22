"use client";

import { useEffect } from "react";

// Recompute insights in the background after the dashboard is interactive, so the
// expensive pass (and its DB writes) never sits on the render path. The server
// throttles repeated calls, so this is cheap.
export function InsightRefresher() {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/insights/refresh", { method: "POST", keepalive: true }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
