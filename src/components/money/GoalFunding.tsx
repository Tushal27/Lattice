"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Inv {
  id: string;
  title: string;
  amount: number;
  frequency: string;
}

// Monthly-equivalent of a contribution (one-time counts as a lump, not monthly).
function monthlyEquiv(inv: Inv): number {
  if (inv.frequency === "monthly") return inv.amount;
  if (inv.frequency === "quarterly") return inv.amount / 3;
  if (inv.frequency === "yearly") return inv.amount / 12;
  return 0;
}

// One-tap linking of monthly SIP investments to a goal. Linked SIPs' monthly
// total feeds the goal's projection (see goalsWithProjection).
export function GoalFunding({
  goalId,
  investments,
  initialLinked,
}: {
  goalId: string;
  investments: Inv[];
  initialLinked: Record<string, string>; // investmentId -> connectionId
}) {
  const router = useRouter();
  const [linked, setLinked] = useState<Record<string, string>>(initialLinked);
  const [busy, setBusy] = useState<string | null>(null);

  if (investments.length === 0) return null;

  const monthlyTotal = investments.filter((i) => linked[i.id]).reduce((s, i) => s + monthlyEquiv(i), 0);

  async function toggle(inv: Inv) {
    setBusy(inv.id);
    try {
      if (linked[inv.id]) {
        await fetch(`/api/connections?id=${linked[inv.id]}`, { method: "DELETE" });
        setLinked((prev) => {
          const n = { ...prev };
          delete n[inv.id];
          return n;
        });
      } else {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromId: goalId, toId: inv.id, note: "funds this goal" }),
        });
        const c = await res.json();
        if (!res.ok) throw new Error();
        setLinked((prev) => ({ ...prev, [inv.id]: c.id }));
      }
      router.refresh();
    } catch {
      toast("Couldn't update the link", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="elev mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
      <h3 className="section-label mb-1">Funding this goal</h3>
      <p className="mb-3 text-xs text-zinc-500">
        Link the SIPs that feed this goal — their monthly total drives the projection.
        {monthlyTotal > 0 && (
          <>
            {" "}
            Linked: <span className="tabnums text-cyan-300">{formatMoney(monthlyTotal)}/mo</span>.
          </>
        )}
      </p>
      <div className="space-y-2">
        {investments.map((inv) => {
          const on = Boolean(linked[inv.id]);
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{inv.title}</p>
                <p className="tabnums text-[11px] text-zinc-500">
                  {formatMoney(inv.amount)} · {inv.frequency}
                </p>
              </div>
              <button
                onClick={() => toggle(inv)}
                disabled={busy === inv.id}
                className={cn(
                  "press shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                  on
                    ? "bg-cyan-600/90 text-white hover:bg-cyan-600"
                    : "border border-white/10 text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-200",
                )}
              >
                {on ? "✓ Linked" : "＋ Link"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
