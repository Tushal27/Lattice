import { drainJobs } from "@/lib/jobs";

// Drain the background job queue. Called by cron; also safe to hit manually.
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  const result = await drainJobs();
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
