import { backfillEmbeddings, countMissingEmbeddings, embeddingsEnabled } from "@/lib/embeddings";

// GET → how many entries still need embedding. POST → embed a batch, returning
// how many remain so the client can loop to completion.
export async function GET() {
  if (!embeddingsEnabled()) return Response.json({ enabled: false });
  return Response.json({ enabled: true, ...(await countMissingEmbeddings()) });
}

export async function POST() {
  if (!embeddingsEnabled()) return Response.json({ enabled: false, embedded: 0, remaining: 0 });
  const result = await backfillEmbeddings(200);
  return Response.json({ enabled: true, ...result });
}
