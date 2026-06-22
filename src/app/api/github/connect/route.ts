import { setGithubToken, githubUser } from "@/lib/github";

// Store a GitHub Personal Access Token after validating it.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const tok = String(body.token ?? "").trim();
  if (!tok) return Response.json({ error: "A token is required." }, { status: 400 });

  await setGithubToken(tok);
  const user = await githubUser();
  if (!user) {
    return Response.json({ error: "That token didn't work — check it has read access." }, { status: 401 });
  }
  return Response.json({ ok: true, login: user.login });
}
