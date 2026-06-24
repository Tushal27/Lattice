"use client";

import { useEffect } from "react";

// Recompute insights in the background after the dashboard is interactive, so the
// expensive pass (and its DB writes) never sits on the render path. The server
// throttles repeated calls, so this is cheap.
export function InsightRefresher() {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/insights/refresh", { method: "POST", keepalive: true }).catch(() => {});
      // Keep the server's timezone in sync with this device, so autonomy timing
      // (quiet hours, review scheduling) is right without any manual config.
      fetch("/api/autonomy/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz: -new Date().getTimezoneOffset() }),
        keepalive: true,
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
