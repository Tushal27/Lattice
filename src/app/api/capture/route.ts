import { runAgent } from "@/lib/agent";
import { fetchReadable, ingestText } from "@/lib/ingest";
import { getRollingMemory } from "@/lib/memory";

// Universal capture endpoint for the native app's Share-to-Lattice and voice
// quick-capture. Anything with a link → ingest the page; anything else → run it
// through the agent so it's classified and filed like typed capture.
//
// Auth: same secret as /api/sms (SMS_INGEST_SECRET, falling back to CRON_SECRET).

function authed(request: Request, url: URL): boolean {
  const secret = process.env.SMS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return true; // single-user, no secret set → open
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!authed(request, url)) return new Response("Unauthorized", { status: 401 });

  let text = "";
  if (request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { text?: string; message?: string };
    text = String(body.text ?? body.message ?? "").trim();
  }
  if (!text) text = (url.searchParams.get("text") ?? "").trim();
  if (!text) return Response.json({ error: "No text to capture." }, { status: 400 });

  // If the shared content contains a link, capture the page itself.
  const link = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (link) {
    const readable = await fetchReadable(link).catch(() => null);
    if (readable && readable.text.trim()) {
      const result = await ingestText({
        provider: "url",
        title: readable.title || link,
        text: `${readable.title}\nSource: ${link}\n\n${readable.text}`,
        externalId: link,
      });
      return Response.json({ ok: true, kind: "link", title: result.title, entryId: result.entryId });
    }
    // Unreadable link → fall through and let the agent capture the raw text.
  }

  const result = await runAgent(text, [], { preserveRaw: true, memory: await getRollingMemory() });
  return Response.json({ ok: true, kind: "note", reply: result.reply });
}

export async function POST(request: Request) {
  return handle(request);
}
export async function GET(request: Request) {
  return handle(request);
}
