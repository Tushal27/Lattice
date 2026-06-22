import { getRollingMemory, setRollingMemory } from "@/lib/memory";

// Server-side rolling memory. GET to read it (the chat shows a "remembers the
// gist" chip); POST to set it — used for the one-time migration of a device's
// existing localStorage memory into the shared server store.
export async function GET() {
  return Response.json({ memory: await getRollingMemory() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { memory?: string };
  if (typeof body.memory !== "string") {
    return Response.json({ error: "memory (string) required" }, { status: 400 });
  }
  await setRollingMemory(body.memory);
  return Response.json({ ok: true });
}
