import { ingestText } from "@/lib/ingest";

// Ingest a text/markdown file. The client reads the file's text (FileReader) and
// posts it here, so there are no server-side file-parsing dependencies.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: string; text?: string };
  const text = String(body.text ?? "");
  const title = String(body.title ?? "Untitled").slice(0, 140);
  if (!text.trim()) return Response.json({ error: "Empty file." }, { status: 400 });

  const result = await ingestText({ provider: "file", title, text });
  return Response.json(result);
}
