import { searchEntries } from "@/lib/entries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);
  const results = await searchEntries(q);
  return Response.json(
    results.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      summary: e.summary,
    })),
  );
}
