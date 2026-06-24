import { addPersonNote, deletePerson, ensurePeopleFromEntries, listPeople } from "@/lib/people";

export async function GET(request: Request) {
  // ?refresh=1 derives people from recent entries before returning.
  if (new URL(request.url).searchParams.get("refresh")) {
    await ensurePeopleFromEntries().catch(() => 0);
  }
  return Response.json({ people: await listPeople() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; note?: string };
  if (!body.id || !body.note?.trim()) return Response.json({ error: "id and note required" }, { status: 400 });
  await addPersonNote(String(body.id), String(body.note));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  await deletePerson(String(body.id));
  return Response.json({ ok: true });
}
