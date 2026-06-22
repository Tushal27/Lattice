import { disconnectGmail } from "@/lib/gmail";

export async function POST() {
  await disconnectGmail();
  return Response.json({ ok: true });
}
