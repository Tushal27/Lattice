import { gmailAccountEmail, gmailConnected, gmailEnabled } from "@/lib/gmail";

export async function GET() {
  const enabled = gmailEnabled();
  if (!enabled) return Response.json({ enabled: false, connected: false, email: null });
  const connected = await gmailConnected();
  return Response.json({ enabled, connected, email: connected ? await gmailAccountEmail() : null });
}
