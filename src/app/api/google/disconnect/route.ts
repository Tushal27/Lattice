import { disconnectGoogle } from "@/lib/google";

export async function POST() {
  await disconnectGoogle();
  return Response.json({ ok: true });
}
