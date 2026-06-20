import {
  cancelCommitment,
  completeCommitment,
  deleteCommitment,
  parseDueDate,
  snoozeCommitment,
  updateCommitment,
} from "@/lib/commitments";

export async function PATCH(request: Request, { params }: RouteContext<"/api/commitments/[id]">) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const action = String(body.action ?? "");
    if (action === "complete") return Response.json(await completeCommitment(id));
    if (action === "snooze") return Response.json(await snoozeCommitment(id, Number(body.days) || 1));
    if (action === "cancel") return Response.json(await cancelCommitment(id));

    // Plain edit: title / due / priority / description.
    const tz = Number.isFinite(body.tz) ? Number(body.tz) : 0;
    const dueRaw = body.due ?? body.dueDate;
    const data: Parameters<typeof updateCommitment>[1] = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.priority === "string") data.priority = body.priority;
    if (typeof dueRaw === "string") data.dueDate = parseDueDate(dueRaw, new Date(), tz);
    return Response.json(await updateCommitment(id, data));
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/commitments/[id]">) {
  const { id } = await params;
  try {
    await deleteCommitment(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
