import { runHeartbeat } from "@/lib/heartbeat";

// The heartbeat endpoint — call it as often as you like (GitHub Actions every
// 15 min is ideal; Vercel Cron hits it too as a fallback). It's idempotent:
// time-gated guards mean nothing fires more than once per slot per day.

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  const result = await runHeartbeat();
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
