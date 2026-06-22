import { addFacts, deleteFact, getRollingMemory, listFacts, setRollingMemory } from "@/lib/memory";

// Server-side memory: the rolling summary + the structured facts store. GET reads
// both; POST sets the rolling memory (one-time localStorage migration) or adds a
// fact; DELETE removes a fact.
export async function GET() {
  const [memory, facts] = await Promise.all([getRollingMemory(), listFacts(40)]);
  return Response.json({ memory, facts });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { memory?: string; fact?: string };
  if (typeof body.fact === "string" && body.fact.trim()) {
    await addFacts([body.fact]);
    return Response.json({ ok: true });
  }
  if (typeof body.memory === "string") {
    await setRollingMemory(body.memory);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "memory or fact required" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  await deleteFact(String(body.id));
  return Response.json({ ok: true });
}
