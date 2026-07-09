import { registerFcmToken } from "@/lib/fcm";

// The native app posts its FCM device token here so briefs/nudges can reach it.
// Auth: same secret as /api/sms (SMS_INGEST_SECRET → CRON_SECRET).
function authed(request: Request, url: URL): boolean {
  const secret = process.env.SMS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!authed(request, url)) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? "").trim();
  if (!token) return Response.json({ error: "token required" }, { status: 400 });
  await registerFcmToken(token);
  return Response.json({ ok: true });
}
