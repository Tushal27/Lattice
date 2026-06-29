import { buildEntryInput, createEntry, listEntries } from "@/lib/entries";
import { isEntryType } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  const entries = await listEntries({
    type: type && isEntryType(type) ? type : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  return Response.json(entries);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = buildEntryInput(String(body.type ?? ""), body);
  if (!input) return Response.json({ error: "Unknown entry type" }, { status: 400 });
  if (!input.title) return Response.json({ error: "A title is required" }, { status: 400 });

  const entry = await createEntry(input);
  return Response.json(entry, { status: 201 });
}
