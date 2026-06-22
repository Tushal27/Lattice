import { googleConnected, googleEmail, googleEnabled } from "@/lib/google";

export async function GET() {
  const enabled = googleEnabled();
  if (!enabled) return Response.json({ enabled: false, connected: false, email: null });
  const connected = await googleConnected();
  return Response.json({ enabled, connected, email: connected ? await googleEmail() : null });
}
