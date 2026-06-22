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

/** Fetch a URL and reduce it to readable title + text (no heavy deps). */
export async function fetchReadable(url: string): Promise<{ title: string; text: string } | null> {
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

  // Plain text / markdown: use as-is.
  if (ctype.includes("text/plain") || ctype.includes("markdown")) {
    return { title: url, text: raw.slice(0, 12000) };
  }

  const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url)
    .replace(/\s+/g, " ")
    .trim();
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);

  return { title, text };
}
