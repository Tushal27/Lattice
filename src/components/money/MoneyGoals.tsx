"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { Card } from "@/components/ui";
import { formatMoney, type GoalProjection } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface GoalDTO {
  id: string;
  title: string;
  current: number;
  target: number;
  monthly: number;
  monthlyFromLink: boolean;
  pct: number;
  projection: GoalProjection;
}

function ProjectionLine({ g }: { g: GoalDTO }) {
  const p = g.projection;
  if (!p.hasDeadline) return <p className="mt-1.5 text-[11px] text-zinc-500">Add a deadline to see if you&apos;re on track.</p>;
  if (g.monthly <= 0)
    return <p className="mt-1.5 text-[11px] text-zinc-500">Add a monthly amount (or link a SIP) to project.</p>;

  const tone =
    p.status === "behind" ? "text-amber-300" : p.status === "ahead" ? "text-emerald-300" : "text-emerald-300/90";
  const label = p.status === "behind" ? "Behind" : p.status === "ahead" ? "Ahead" : "On track";
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
      <span className={cn("font-medium", tone)}>{label}</span> · projected{" "}
      <span className="tabnums text-zinc-300">{formatMoney(p.projectedValue)}</span> by deadline (
      {Math.round(p.onTrackPct)}% of target) at {formatMoney(g.monthly)}/mo
      {g.monthlyFromLink ? " from linked SIPs" : ""}
      {p.status === "behind" && p.requiredMonthly > 0 && (
        <>
          {" "}
          · need <span className="tabnums text-amber-200">{formatMoney(p.requiredMonthly)}/mo</span> to hit it
        </>
      )}
      .
    </p>
  );
}

export function MoneyGoals({ goals }: { goals: GoalDTO[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function contribute(id: string) {
    const value = Number(amount.replace(/[^0-9.]/g, ""));
    if (!value || busy) return;
    setBusy(id);
    try {
      const res = await fetch("/api/money/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, amount: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast(data.reached ? "Goal reached 🎉" : "Added to goal");
      setOpenId(null);
      setAmount("");
      router.refresh();
    } catch {
      toast("Couldn't update the goal", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remindMonthly(g: GoalDTO) {
    setBusy(g.id);
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Contribute to ${g.title}`,
          due: "in 1 month",
          recurringRule: "monthly",
          sourceType: "goal",
          sourceId: g.id,
          tz: new Date().getTimezoneOffset(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Monthly reminder set");
    } catch {
      toast("Couldn't set reminder", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="section-label mb-4">Goals</h2>
      <div className="space-y-5">
        {goals.map((g) => (
          <div key={g.id}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <Link href={`/entry/${g.id}`} className="truncate text-zinc-200 hover:text-white">
                {g.title}
              </Link>
              <span className="tabnums shrink-0 text-zinc-500">
                {formatMoney(g.current)} / {formatMoney(g.target)} · {g.pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${g.pct}%` }} />
            </div>
            <ProjectionLine g={g} />
            <div className="mt-2 flex items-center gap-2">
              {openId === g.id ? (
                <>
                  <input
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="amount"
                    className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/40 focus:outline-none"
                  />
                  <button
                    onClick={() => contribute(g.id)}
                    disabled={busy === g.id}
                    className="press rounded-lg bg-cyan-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button onClick={() => setOpenId(null)} className="press rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
                    cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setOpenId(g.id);
                      setAmount("");
                    }}
                    className="press rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-200"
                  >
                    ＋ Add contribution
                  </button>
                  <button
                    onClick={() => remindMonthly(g)}
                    disabled={busy === g.id}
                    className="press rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
                  >
                    🔔 Remind monthly
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
