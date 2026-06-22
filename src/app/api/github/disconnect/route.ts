import { disconnectGithub } from "@/lib/github";

export async function POST() {
  await disconnectGithub();
  return Response.json({ ok: true });
}
