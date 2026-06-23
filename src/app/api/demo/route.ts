import { clearDemo, demoLoaded, seedDemo } from "@/lib/demo";

export async function GET() {
  return Response.json({ loaded: await demoLoaded() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "clear") return Response.json(await clearDemo());
  return Response.json(await seedDemo());
}
