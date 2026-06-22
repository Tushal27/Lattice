import { listTrust, setTrust, type Trust } from "@/lib/capabilities";

export async function GET() {
  return Response.json({ capabilities: await listTrust() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { key?: string; trust?: string };
  const key = String(body.key ?? "");
  const trust = body.trust as Trust;
  if (!key || !["off", "ask", "auto"].includes(trust)) {
    return Response.json({ error: "key and trust (off|ask|auto) required" }, { status: 400 });
  }
  await setTrust(key, trust);
  return Response.json({ ok: true });
}
