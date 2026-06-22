import { runAgent, type AgentTurn } from "@/lib/agent";

export async function POST(request: Request) {
  let body: { message?: string; history?: AgentTurn[]; preserveRaw?: boolean; images?: string[]; tz?: number; memory?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
  if (!message && images.length === 0) {
    return Response.json({ error: "message or image required" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const fallbackMessage = message || "Capture what's in the attached image.";
  const result = await runAgent(fallbackMessage, history, {
    preserveRaw: body.preserveRaw !== false && Boolean(message),
    images,
    tz: Number.isFinite(body.tz) ? Number(body.tz) : 0,
    memory: typeof body.memory === "string" ? body.memory : "",
  });
  return Response.json(result);
}
