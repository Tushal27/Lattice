import { githubConnected, githubUser } from "@/lib/github";

export async function GET() {
  if (!(await githubConnected())) return Response.json({ connected: false, login: null });
  const user = await githubUser();
  // A stored-but-invalid token reads as not connected.
  return Response.json({ connected: Boolean(user), login: user?.login ?? null });
}
