import { aiEnabled } from "@/lib/ai";
import { askPartnerStream } from "@/lib/companion";
import { getRollingMemory } from "@/lib/memory";

// Streaming Wonder chat — returns the answer as a raw UTF-8 text stream so the
// UI can render tokens the instant they arrive (low time-to-first-token).
// Memory is loaded server-side so continuity is the same on every device.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    history?: { role: string; text: string }[];
  };
  const message = String(body.message ?? "").trim();
  if (!message) return new Response("message required", { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const memory = await getRollingMemory();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of askPartnerStream(message, history, memory)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        controller.enqueue(encoder.encode(""));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-AI": aiEnabled() ? "on" : "off",
    },
  });
}
