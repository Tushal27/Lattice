"use client";

import Link from "next/link";
import { useModuleScope } from "@/components/ModuleSwitcher";
import { formatMoney } from "@/lib/format";

export interface MoneyWidgetData {
  spendTotal: number;
  spendCount: number;
  worst: { id: string; title: string; amount: number } | null;
}

// Side-rail money pulse, shown only in the All or Money lens.
export function MoneyWidget({ data }: { data: MoneyWidgetData }) {
  const { active } = useModuleScope();
  if (active !== "all" && active !== "money") return null;
  if (data.spendCount === 0 && !data.worst) return null;

  return (
    <div className="elev rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-amber-200">
        <span className="flex items-center gap-2">💰 Money · this month</span>
        <Link href="/money" className="text-[11px] font-normal text-amber-300/70 hover:text-amber-200">
          review →
        </Link>
      </h3>
      <div className="tabnums text-2xl font-semibold text-zinc-100">{formatMoney(data.spendTotal)}</div>
      <p className="text-xs text-zinc-500">{data.spendCount} remembered</p>
      {data.worst && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-0.5 text-[11px] text-rose-300/80">Most regretted</div>
          <Link href={`/entry/${data.worst.id}`} className="block text-sm text-zinc-200 hover:text-white">
            {data.worst.title} <span className="tabnums text-zinc-500">· {formatMoney(data.worst.amount)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
