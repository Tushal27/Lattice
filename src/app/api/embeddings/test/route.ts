import { embed, embeddingsEnabled } from "@/lib/embeddings";

// A one-tap diagnostic: is EMBEDDINGS_MODEL set, and does the roster actually
// return vectors for it? Used by the "Semantic memory" status card.
export async function GET() {
  if (!embeddingsEnabled()) {
    return Response.json({ enabled: false });
  }
  const model = process.env.EMBEDDINGS_MODEL ?? null;
  const vectors = await embed(["lattice semantic memory test"]);
  if (!vectors || !vectors[0]?.length) {
    return Response.json({ enabled: true, ok: false, model });
  }
  return Response.json({ enabled: true, ok: true, model, dimensions: vectors[0].length });
}
