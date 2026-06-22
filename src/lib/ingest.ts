import { logAction } from "@/lib/capabilities";
import { extractKnowledge } from "@/lib/companion";
import { prisma } from "@/lib/db";
import { autoLinkByTags, buildEntryInput, createEntry } from "@/lib/entries";
import { isEntryType } from "@/lib/types";

// The shared ingestion path. Files, web pages, and GitHub all funnel through
// here: distill the raw content into one structured entry, record provenance in
// Source (so nothing is ingested twice), auto-link it into the graph, and audit
// it. Adding a new ingestion source = call ingestText with a provider.

export type IngestProvider = "file" | "url" | "github";

export interface IngestInput {
  provider: IngestProvider;
  title: string;
  text: string;
  /** Stable id for dedupe (url, repo+date, file hash). Omit to always ingest. */
  externalId?: string | null;
  /** Preferred entry type when the extractor is unsure. */
  typeHint?: string;
  tags?: string[];
}

export interface IngestResult {
  ok: boolean;
  entryId?: string;
  title?: string;
  type?: string;
  skipped?: boolean;
  reason?: string;
}

export async function ingestText(input: IngestInput): Promise<IngestResult> {
  const text = (input.text ?? "").trim();
  if (!text) return { ok: false, reason: "Nothing to ingest." };

  // Dedupe by provenance.
  if (input.externalId) {
    const existing = await prisma.source.findFirst({
      where: { provider: input.provider, externalId: input.externalId },
    });
    if (existing) {
      return { ok: true, skipped: true, reason: "Already captured.", entryId: existing.entryId ?? undefined, title: existing.title };
    }
  }

  const k = await extractKnowledge(text, { source: input.provider, title: input.title });
  const type = isEntryType(k.type) ? k.type : isEntryType(input.typeHint ?? "") ? input.typeHint! : "lesson";

  const entryInput = buildEntryInput(type, {
    type,
    title: k.title || input.title,
    summary: k.summary,
    tags: k.tags?.length ? k.tags : input.tags,
    // Keep the source content so nothing is lost; cap to a sane size.
    details: text.slice(0, 12000),
  });
  if (!entryInput || !entryInput.title) return { ok: false, reason: "Couldn't structure that content." };

  const entry = await createEntry(entryInput);
  await prisma.source.create({
    data: { provider: input.provider, externalId: input.externalId ?? null, title: entryInput.title, entryId: entry.id },
  });
  // Weave it into the graph like any captured entry.
  await autoLinkByTags(entry.id, 2).catch(() => []);

  await logAction({
    capability: `${input.provider}.ingest`,
    summary: `Captured from ${input.provider}: ${entryInput.title}`,
    source: input.provider,
    entityId: entry.id,
  });

  return { ok: true, entryId: entry.id, title: entryInput.title, type };
}

// Decode the HTML entities that actually show up in readable text.
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return " ";
      }
    });
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|aside)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Prefer the main article body when the page marks one up — much cleaner than
// stripping the whole document (nav, menus, footers).
function extractArticle(html: string): { title: string; text: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const block =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html;
  const text = stripTags(block.length > 400 ? block : html).slice(0, 10000);
  return { title, text };
}

async function youtubeMeta(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { title?: string; author_name?: string };
    if (!d.title) return null;
    return { title: d.title, text: `YouTube video: ${d.title}${d.author_name ? `\nBy: ${d.author_name}` : ""}\nSource: ${url}` };
  } catch {
    return null;
  }
}

async function githubRepoMeta(u: URL): Promise<{ title: string; text: string } | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return null;
  const full = `${m[1]}/${m[2].replace(/\.git$/, "")}`;
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${full}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Lattice" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!repoRes.ok) return null;
    const repo = (await repoRes.json()) as { full_name: string; description?: string; language?: string; stargazers_count?: number };
    let readme = "";
    try {
      const rdRes = await fetch(`https://api.github.com/repos/${full}/readme`, {
        headers: { Accept: "application/vnd.github.raw", "User-Agent": "Lattice" },
        signal: AbortSignal.timeout(12_000),
      });
      if (rdRes.ok) readme = (await rdRes.text()).slice(0, 8000);
    } catch {
      /* readme optional */
    }
    const text = [
      `GitHub repo: ${repo.full_name}`,
      repo.description ? `Description: ${repo.description}` : "",
      repo.language ? `Language: ${repo.language}` : "",
      repo.stargazers_count != null ? `Stars: ${repo.stargazers_count}` : "",
      readme ? `\nREADME:\n${readme}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { title: repo.full_name, text };
  } catch {
    return null;
  }
}

/** Fetch a URL and reduce it to readable title + text. Special-cases YouTube
 *  (oEmbed) and GitHub repos (API + README); otherwise article-aware HTML. */
export async function fetchReadable(url: string): Promise<{ title: string; text: string } | null> {
  let host = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      const yt = await youtubeMeta(url);
      if (yt) return yt;
    }
    if (host === "github.com") {
      const gh = await githubRepoMeta(u);
      if (gh) return gh;
    }
  } catch {
    return null;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LatticeBot/1.0)", Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const ctype = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (ctype.includes("text/plain") || ctype.includes("markdown")) {
    return { title: url, text: raw.slice(0, 12000) };
  }

  const { title, text } = extractArticle(raw);
  return { title: title || url, text };
}
