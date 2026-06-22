import { fetchReadable, ingestText } from "@/lib/ingest";
import { enqueueJob } from "@/lib/jobs";

// Capture a web page / article / link: fetch it server-side, reduce to readable
// text, and distill into a knowledge entry. Deduped by URL. Pass {async:true} to
// queue it (returns immediately) instead of blocking on the fetch+distill.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string; async?: boolean };
  let url = String(body.url ?? "").trim();
  if (!url) return Response.json({ error: "A URL is required." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
  } catch {
    return Response.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }

  if (body.async) {
    await enqueueJob("ingest.url", { url });
    return Response.json({ ok: true, queued: true, url });
  }

  const readable = await fetchReadable(url);
  if (!readable || !readable.text.trim()) {
    return Response.json({ error: "Couldn't read anything from that link." }, { status: 422 });
  }

  const result = await ingestText({
    provider: "url",
    title: readable.title || url,
    text: `${readable.title}\nSource: ${url}\n\n${readable.text}`,
    externalId: url,
  });
  return Response.json({ ...result, url });
}
