import { runAgent, type AgentTurn } from "@/lib/agent";

export async function POST(request: Request) {
  let body: { message?: string; history?: AgentTurn[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const result = await runAgent(message, history);
  return Response.json(result);
}
