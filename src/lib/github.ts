import { prisma } from "@/lib/db";

// GitHub connector. Uses a Personal Access Token (read-only scopes) stored in
// AppState — simpler than a full OAuth dance for a single-user app, and inert
// until a token is added. Reads recent activity so the assistant can turn your
// engineering work into knowledge and insights.

const TOKEN_KEY = "github:token";

async function token(): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key: TOKEN_KEY } });
  return row?.value ?? null;
}

export async function githubConnected(): Promise<boolean> {
  return Boolean(await token());
}

export async function setGithubToken(t: string): Promise<void> {
  await prisma.appState.upsert({ where: { key: TOKEN_KEY }, create: { key: TOKEN_KEY, value: t }, update: { value: t } });
}

export async function disconnectGithub(): Promise<void> {
  await prisma.appState.deleteMany({ where: { key: TOKEN_KEY } });
}

async function gh<T>(path: string): Promise<T | null> {
  const t = await token();
  if (!t) return null;
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Lattice",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function githubUser(): Promise<{ login: string } | null> {
  return gh<{ login: string }>("/user");
}

export interface Repo {
  full_name: string;
  description: string | null;
  pushed_at: string;
  language: string | null;
  html_url: string;
}

export async function recentRepos(limit = 8): Promise<Repo[]> {
  const repos = await gh<Repo[]>(`/user/repos?sort=pushed&per_page=${limit}&affiliation=owner,collaborator`);
  return repos ?? [];
}

interface Commit {
  commit: { message: string; author: { name: string; date: string } };
}

/** Recent commit messages on a repo (default branch), most recent first. */
async function recentCommits(fullName: string, login: string, limit = 5): Promise<string[]> {
  const commits = await gh<Commit[]>(`/repos/${fullName}/commits?author=${login}&per_page=${limit}`);
  return (commits ?? []).map((c) => c.commit.message.split("\n")[0]).filter(Boolean);
}

export interface ActivitySnapshot {
  login: string;
  repos: { name: string; description: string | null; language: string | null; pushedAt: string; commits: string[] }[];
}

/** A snapshot of recent engineering activity, ready to distill into knowledge. */
export async function activitySnapshot(): Promise<ActivitySnapshot | null> {
  const user = await githubUser();
  if (!user) return null;
  const repos = await recentRepos(6);
  const out: ActivitySnapshot["repos"] = [];
  for (const r of repos.slice(0, 5)) {
    const commits = await recentCommits(r.full_name, user.login, 5);
    out.push({ name: r.full_name, description: r.description, language: r.language, pushedAt: r.pushed_at, commits });
  }
  return { login: user.login, repos: out };
}

/** Render a snapshot into plain text for the ingestion/extraction step. */
export function snapshotToText(s: ActivitySnapshot): string {
  const lines = [`Recent GitHub engineering activity for @${s.login}:`, ""];
  for (const r of s.repos) {
    lines.push(`Repo: ${r.name}${r.language ? ` (${r.language})` : ""}`);
    if (r.description) lines.push(`  ${r.description}`);
    if (r.commits.length) {
      lines.push("  Recent commits:");
      for (const c of r.commits) lines.push(`   - ${c}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
