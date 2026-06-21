// Optional semantic embeddings, reusing your OpenAI-compatible roster.
//
// Enabled only when EMBEDDINGS_MODEL is set (base URL + key default to the
// custom roster's AI_BASE_URL / AI_API_KEY, but can be overridden). When it's
// off, every caller falls back to the lexical path — nothing breaks.
//
//   EMBEDDINGS_MODEL="text-embedding-3-small"   # or whatever your roster serves
//   EMBEDDINGS_BASE_URL="https://…/v1"          # optional, defaults to AI_BASE_URL
//   EMBEDDINGS_API_KEY="…"                       # optional, defaults to AI_API_KEY

import { prisma } from "@/lib/db";

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.EMBEDDINGS_MODEL && (process.env.EMBEDDINGS_BASE_URL || process.env.AI_BASE_URL));
}

function config() {
  const base = (process.env.EMBEDDINGS_BASE_URL || process.env.AI_BASE_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.EMBEDDINGS_API_KEY || process.env.AI_API_KEY || "").trim();
  const model = (process.env.EMBEDDINGS_MODEL || "").trim();
  // Candidate endpoints: an explicit override, else the standard /embeddings and
  // the singular /embedding some gateways use.
  const override = process.env.EMBEDDINGS_URL?.trim();
  const urls = override ? [override] : base ? [`${base}/embeddings`, `${base}/embedding`] : [];
  return { urls, key, model };
}

/** Embed a batch of texts. Returns null on any failure so callers can fall back. */
export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsEnabled() || texts.length === 0) return null;
  const { urls, key, model } = config();
  if (urls.length === 0) return null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, input: texts }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        // 404/405 → likely the wrong path; try the next candidate.
        if ((res.status === 404 || res.status === 405) && urls.length > 1) continue;
        console.warn("embeddings", res.status, await res.text().catch(() => ""));
        return null;
      }
      const data = await res.json();
      const vectors: number[][] = (data?.data ?? []).map((d: { embedding: number[] }) => d.embedding);
      if (vectors.length === texts.length) return vectors;
      return null;
    } catch (err) {
      console.error("embeddings failed", err);
    }
  }
  return null;
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function parseVector(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length ? (v as number[]) : null;
  } catch {
    return null;
  }
}

/**
 * Cosine threshold above which two entries count as "the same topic". Different
 * embedding models occupy different similarity ranges, so the sensible default
 * depends on the model — Google's text-embedding-004 sits lower than OpenAI's.
 * EMBEDDINGS_SIM_THRESHOLD overrides everything.
 */
export function simThreshold(): number {
  const override = Number(process.env.EMBEDDINGS_SIM_THRESHOLD);
  if (Number.isFinite(override) && override > 0) return override;
  const model = (process.env.EMBEDDINGS_MODEL || "").toLowerCase();
  if (model.includes("004") || model.includes("multilingual") || model.includes("google")) return 0.68;
  if (model.includes("mistral")) return 0.7;
  if (model.includes("text-embedding-3")) return 0.78;
  return 0.72;
}

export interface EmbeddableEntry {
  id: string;
  title: string;
  summary: string | null;
  embedding: string | null;
}

/**
 * Ensure the given entries have stored embeddings, computing+persisting any that
 * are missing (capped per call to bound latency/cost). Returns a map id→vector
 * for everything that now has one. No-op when embeddings are disabled.
 */
export async function ensureEmbeddings(
  entries: EmbeddableEntry[],
  max = 24,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!embeddingsEnabled()) return out;

  const missing: EmbeddableEntry[] = [];
  for (const e of entries) {
    const v = parseVector(e.embedding);
    if (v) out.set(e.id, v);
    else missing.push(e);
  }

  const batch = missing.slice(0, max);
  if (batch.length) {
    const vectors = await embed(batch.map((e) => `${e.title}\n${e.summary ?? ""}`.trim()));
    if (vectors) {
      await Promise.all(
        batch.map(async (e, i) => {
          out.set(e.id, vectors[i]);
          try {
            await prisma.entry.update({ where: { id: e.id }, data: { embedding: JSON.stringify(vectors[i]) } });
          } catch {
            /* entry may have been deleted; ignore */
          }
        }),
      );
    }
  }
  return out;
}

/** Embed an arbitrary query string (e.g. a search box). Null when disabled/failed. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const v = await embed([text]);
  return v?.[0] ?? null;
}
