"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

// People are derived from your notes by an AI pass. This kicks that pass off on
// demand (and once automatically if the list is empty) so the page populates
// without waiting for the daily autonomy run.
export function PeopleSync({ empty }: { empty: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);

  async function scan() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/people?refresh=1");
      router.refresh();
      if (!auto.current) toast("Scanned your notes for people");
    } catch {
      toast("Couldn't scan right now", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (empty && !auto.current) {
      auto.current = true;
      scan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);

  return (
    <button
      onClick={scan}
      disabled={busy}
      className="press rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "Scanning notes…" : "↻ Scan my notes for people"}
    </button>
  );
}
