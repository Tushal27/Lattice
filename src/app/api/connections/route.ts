import { addConnection, removeConnection } from "@/lib/entries";

export async function POST(request: Request) {
  let body: { fromId?: string; toId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.fromId || !body.toId) {
    return Response.json({ error: "fromId and toId are required" }, { status: 400 });
  }
  try {
    const connection = await addConnection(body.fromId, body.toId, body.note);
    return Response.json(connection, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  try {
    await removeConnection(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
