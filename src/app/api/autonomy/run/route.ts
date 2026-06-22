import { runAutonomy } from "@/lib/autonomy";

// Manual trigger for the autonomy engine (the cron runs it automatically).
export async function POST() {
  const result = await runAutonomy();
  return Response.json({ ok: true, ...result });
}
