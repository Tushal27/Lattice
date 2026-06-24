import { prisma } from "@/lib/db";
import { parseFields } from "@/lib/utils";

// Set an expense's "worth it?" rating — called from a push notification's action
// buttons (tap-to-rate, no app needed) or anywhere else.
const MAP: Record<string, string> = { worth: "Worth it", regret: "Regret", mixed: "Meh" };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; rating?: string };
  const id = String(body.id ?? "");
  const satisfaction = MAP[String(body.rating ?? "")];
  if (!id || !satisfaction) return Response.json({ error: "id and rating (worth|regret|mixed) required" }, { status: 400 });

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });

  const f = parseFields(entry.fields);
  f.satisfaction = satisfaction;
  await prisma.entry.update({ where: { id }, data: { fields: JSON.stringify(f) } });
  return Response.json({ ok: true });
}
