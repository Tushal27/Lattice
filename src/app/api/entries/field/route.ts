import { prisma } from "@/lib/db";
import { parseFields } from "@/lib/utils";

// Merge a few fields (and optionally status) into an entry — used for in-place
// edits like refining/accepting an AI draft answer, without the full edit form
// (which would otherwise drop fields it doesn't know about).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; set?: Record<string, string>; status?: string };
  const id = String(body.id ?? "");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });

  const data: { fields?: string; status?: string } = {};
  if (body.set && typeof body.set === "object") {
    const f = parseFields(entry.fields);
    for (const [k, v] of Object.entries(body.set)) f[k] = String(v);
    data.fields = JSON.stringify(f);
  }
  if (typeof body.status === "string") data.status = body.status;
  if (Object.keys(data).length) await prisma.entry.update({ where: { id }, data });
  return Response.json({ ok: true });
}
