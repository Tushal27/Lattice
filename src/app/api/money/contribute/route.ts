import { prisma } from "@/lib/db";
import { parseAmount } from "@/lib/money";
import { parseFields } from "@/lib/utils";

// Bump a goal's "saved so far" without a full edit — one-tap progress.
export async function POST(request: Request) {
  let body: { id?: string; amount?: number | string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const add = parseAmount(String(body.amount ?? ""));
  if (!id || add <= 0) return Response.json({ error: "id and a positive amount are required" }, { status: 400 });

  const entry = await prisma.entry.findUnique({ where: { id }, select: { type: true, fields: true, status: true } });
  if (!entry || entry.type !== "goal") return Response.json({ error: "Not a goal" }, { status: 404 });

  const f = parseFields(entry.fields);
  const target = parseAmount(f.amount);
  const current = parseAmount(f.current) + add;
  f.current = String(current);

  const reached = target > 0 && current >= target;
  await prisma.entry.update({
    where: { id },
    data: { fields: JSON.stringify(f), ...(reached ? { status: "reached" } : {}) },
  });

  return Response.json({ ok: true, current, target, reached, pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0 });
}
