import { actOnInsight, activeInsights, dismissInsight } from "@/lib/insights";

export async function GET() {
  return Response.json(await activeInsights());
}

export async function PATCH(request: Request) {
  let body: { id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    if (body.action === "dismiss") return Response.json(await dismissInsight(id));
    if (body.action === "act") return Response.json(await actOnInsight(id));
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
