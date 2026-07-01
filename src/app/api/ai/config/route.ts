import { configuredProviders, getAiConfig, rosterConfigured, setAiConfig } from "@/lib/ai";

export async function GET() {
  const cfg = await getAiConfig();
  return Response.json({ ...cfg, rosterConfigured: rosterConfigured(), providers: configuredProviders() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { rosterOnly?: unknown };
  const patch: Parameters<typeof setAiConfig>[0] = {};
  if (typeof body.rosterOnly === "boolean") patch.rosterOnly = body.rosterOnly;
  const cfg = await setAiConfig(patch);
  return Response.json({ ...cfg, rosterConfigured: rosterConfigured(), providers: configuredProviders() });
}
