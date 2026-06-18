import { buildEntryInput, deleteEntry, getEntry, updateEntry } from "@/lib/entries";

export async function GET(_request: Request, { params }: RouteContext<"/api/entries/[id]">) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(entry);
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/entries/[id]">) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = buildEntryInput(String(body.type ?? ""), body);
  if (!input) return Response.json({ error: "Unknown entry type" }, { status: 400 });
  if (!input.title) return Response.json({ error: "A title is required" }, { status: 400 });

  try {
    const entry = await updateEntry(id, input);
    return Response.json(entry);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/entries/[id]">) {
  const { id } = await params;
  try {
    await deleteEntry(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
