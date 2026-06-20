import { askPartner, classifyThought, connectionInsight, judgment, quizBatch, reflection } from "@/lib/companion";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const task = String(body.task ?? "");

  switch (task) {
    case "reflect": {
      const period = body.period === "month" ? "month" : "week";
      return Response.json(await reflection(period));
    }
    case "connect": {
      if (!body.entryId) return Response.json({ error: "entryId required" }, { status: 400 });
      return Response.json(await connectionInsight(String(body.entryId)));
    }
    case "ask": {
      const message = String(body.message ?? "").trim();
      const images = Array.isArray(body.images) ? (body.images as string[]).slice(0, 4) : [];
      if (!message && images.length === 0) return Response.json({ error: "message required" }, { status: 400 });
      const history = Array.isArray(body.history)
        ? (body.history as { role: string; text: string }[]).slice(-10)
        : [];
      return Response.json(await askPartner(message, history, images));
    }
    case "classify": {
      const text = String(body.text ?? "").trim();
      if (!text) return Response.json({ error: "text required" }, { status: 400 });
      return Response.json(await classifyThought(text));
    }
    case "judgment":
      return Response.json(await judgment());
    case "quiz": {
      const items = Array.isArray(body.items) ? body.items : [];
      return Response.json(await quizBatch(items as Parameters<typeof quizBatch>[0]));
    }
    default:
      return Response.json({ error: "Unknown task" }, { status: 400 });
  }
}
