import { dismissProposal, listProposals } from "@/lib/gmail";

export async function GET() {
  return Response.json({ proposals: await listProposals() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  await dismissProposal(String(body.id));
  return Response.json({ ok: true });
}
