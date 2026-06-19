import { prisma } from "@/lib/db";
import { configFor, type EntryType } from "@/lib/types";
import { parseFields } from "@/lib/utils";

export interface EntryInput {
  type: EntryType;
  title: string;
  summary?: string | null;
  status?: string | null;
  confidence?: number | null;
  occurredAt?: Date | null;
  projectId?: string | null;
  tags?: string[];
  fields?: Record<string, string>;
}

const entryDetailInclude = {
  tags: { include: { tag: true } },
  project: { select: { id: true, title: true, type: true } },
  children: { select: { id: true, title: true, type: true, status: true }, orderBy: { createdAt: "desc" } },
  connectionsFrom: { include: { to: { select: { id: true, title: true, type: true, summary: true } } } },
  connectionsTo: { include: { from: { select: { id: true, title: true, type: true, summary: true } } } },
} as const;

export type EntryWithDetail = NonNullable<Awaited<ReturnType<typeof getEntry>>>;

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const cleaned = tags
    .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
    .filter(Boolean);
  return [...new Set(cleaned)];
}

/**
 * Splits a flat form payload (every field as a string) into the structured
 * shape Lattice stores, using the type's config to decide which values are real
 * columns and which belong in the `fields` JSON blob.
 */
export function buildEntryInput(type: string, payload: Record<string, unknown>): EntryInput | null {
  const config = configFor(type);
  if (!config) return null;

  const input: EntryInput = { type: config.type, title: "", fields: {} };
  const fields: Record<string, string> = {};

  for (const def of config.fields) {
    const raw = payload[def.key];
    const value = raw == null ? "" : String(raw).trim();

    if (def.column) {
      switch (def.key) {
        case "title":
          input.title = value;
          break;
        case "summary":
          input.summary = value || null;
          break;
        case "status":
          input.status = value || null;
          break;
        case "confidence":
          input.confidence = value === "" ? null : Number(value);
          break;
        case "occurredAt":
          input.occurredAt = value ? new Date(value) : null;
          break;
      }
    } else if (value) {
      fields[def.key] = value;
    }
  }

  input.fields = fields;
  input.projectId = (payload.projectId ? String(payload.projectId) : null) || null;
  input.tags = normalizeTags(
    Array.isArray(payload.tags)
      ? (payload.tags as string[])
      : typeof payload.tags === "string"
        ? payload.tags.split(",")
        : [],
  );

  return input;
}

const REVIEW_KEYS = ["reviewOutcome", "reviewVerdict", "reviewLearning", "wouldRepeat"];

/** Stamp when a decision was first reviewed, preserving it across later edits. */
function applyReviewStamp(input: EntryInput, existingReviewedAt?: string) {
  if (input.type !== "decision") return;
  const fields = (input.fields ??= {});
  const reviewed = REVIEW_KEYS.some((k) => fields[k]);
  if (!reviewed) return;
  fields.reviewedAt = existingReviewedAt || fields.reviewedAt || new Date().toISOString();
}

export async function createEntry(input: EntryInput) {
  const tags = normalizeTags(input.tags);
  applyReviewStamp(input);
  return prisma.entry.create({
    data: {
      type: input.type,
      title: input.title,
      summary: input.summary ?? null,
      status: input.status ?? null,
      confidence: input.confidence ?? null,
      occurredAt: input.occurredAt ?? null,
      projectId: input.projectId ?? null,
      fields: JSON.stringify(input.fields ?? {}),
      tags: {
        create: tags.map((name) => ({
          tag: { connectOrCreate: { where: { name }, create: { name } } },
        })),
      },
    },
  });
}

export async function updateEntry(id: string, input: EntryInput) {
  const tags = normalizeTags(input.tags);
  const existing = await prisma.entry.findUnique({ where: { id }, select: { fields: true } });
  applyReviewStamp(input, parseFields(existing?.fields).reviewedAt);
  return prisma.$transaction(async (tx) => {
    await tx.entryTag.deleteMany({ where: { entryId: id } });
    return tx.entry.update({
      where: { id },
      data: {
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? null,
        confidence: input.confidence ?? null,
        occurredAt: input.occurredAt ?? null,
        projectId: input.projectId ?? null,
        fields: JSON.stringify(input.fields ?? {}),
        tags: {
          create: tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
    });
  });
}

export async function deleteEntry(id: string) {
  return prisma.entry.delete({ where: { id } });
}

export async function getEntry(id: string) {
  return prisma.entry.findUnique({
    where: { id },
    include: entryDetailInclude,
  });
}

export interface ListOptions {
  type?: EntryType;
  status?: string;
  projectId?: string;
  limit?: number;
}

export async function listEntries(opts: ListOptions = {}) {
  return prisma.entry.findMany({
    where: {
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    include: { tags: { include: { tag: true } }, project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    ...(opts.limit ? { take: opts.limit } : {}),
  });
}

export async function searchEntries(query: string) {
  const q = query.trim();
  if (!q) return [];
  // SQLite LIKE is case-insensitive for ASCII, which is fine here. We search
  // title, summary, the raw fields JSON, and tag names.
  return prisma.entry.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
        { fields: { contains: q } },
        { tags: { some: { tag: { name: { contains: q.toLowerCase() } } } } },
      ],
    },
    include: { tags: { include: { tag: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function listProjects() {
  return prisma.entry.findMany({
    where: { type: "project" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true },
  });
}

export async function addConnection(fromId: string, toId: string, note?: string | null) {
  if (fromId === toId) throw new Error("Cannot connect an entry to itself");
  // Store a single undirected edge with a stable orientation so (a,b) and (b,a)
  // don't both get created.
  const [a, b] = [fromId, toId].sort();
  return prisma.connection.upsert({
    where: { fromId_toId: { fromId: a, toId: b } },
    create: { fromId: a, toId: b, note: note ?? null },
    update: { note: note ?? null },
  });
}

export async function removeConnection(id: string) {
  return prisma.connection.delete({ where: { id } });
}

/**
 * Local, no-AI heuristic: suggest entries that share tags or notable words with
 * the given entry and aren't already connected. Powers the "you might connect
 * this to…" hints even when Gemini is disabled.
 */
export async function suggestConnections(entryId: string, limit = 5) {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { tags: { include: { tag: true } }, connectionsFrom: true, connectionsTo: true },
  });
  if (!entry) return [];

  const connectedIds = new Set<string>([
    entryId,
    ...entry.connectionsFrom.map((c) => c.toId),
    ...entry.connectionsFrom.map((c) => c.fromId),
    ...entry.connectionsTo.map((c) => c.toId),
    ...entry.connectionsTo.map((c) => c.fromId),
  ]);

  const tagNames = new Set(entry.tags.map((t) => t.tag.name));
  const words = keywords(`${entry.title} ${entry.summary ?? ""} ${Object.values(parseFields(entry.fields)).join(" ")}`);

  const candidates = await prisma.entry.findMany({
    include: { tags: { include: { tag: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const scored = candidates
    .filter((c) => !connectedIds.has(c.id))
    .map((c) => {
      const cTags = new Set(c.tags.map((t) => t.tag.name));
      const sharedTags = [...cTags].filter((t) => tagNames.has(t)).length;
      const cWords = keywords(`${c.title} ${c.summary ?? ""} ${Object.values(parseFields(c.fields)).join(" ")}`);
      const sharedWords = [...cWords].filter((w) => words.has(w)).length;
      return { entry: c, score: sharedTags * 3 + sharedWords };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entry);
}

const STOP = new Set(
  "the a an and or but if then else for to of in on at by with from as is are was were be been being this that these those it its i you he she we they them my your our their about into over under not no yes do does did how what why when where which who whom".split(
    " ",
  ),
);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

export async function getStats() {
  const [counts, openQuestions, total] = await Promise.all([
    prisma.entry.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.entry.count({ where: { type: "question", status: "open" } }),
    prisma.entry.count(),
  ]);
  const byType: Record<string, number> = {};
  for (const c of counts) byType[c.type] = c._count._all;
  return { byType, openQuestions, total };
}

/** Decisions made a while ago that haven't been reviewed yet — prompt reflection. */
export async function decisionsAwaitingReview(days = 14) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const decisions = await prisma.entry.findMany({
    where: { type: "decision", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return decisions.filter((d) => {
    const f = parseFields(d.fields);
    return !f.reviewedAt && !f.reviewOutcome;
  });
}

interface EntryColumns {
  title: string;
  summary: string | null;
  status: string | null;
  confidence: number | null;
  occurredAt: Date | null;
  fields: string | null;
}

/** Flattens an entry back into the keyed string values its form/detail view expect. */
export function entryToFormValues(entry: EntryColumns, type: string): Record<string, string> {
  const config = configFor(type);
  if (!config) return {};
  const fields = parseFields(entry.fields);
  const values: Record<string, string> = {};
  for (const def of config.fields) {
    if (def.column) {
      switch (def.key) {
        case "title":
          values.title = entry.title ?? "";
          break;
        case "summary":
          values.summary = entry.summary ?? "";
          break;
        case "status":
          values.status = entry.status ?? "";
          break;
        case "confidence":
          values.confidence = entry.confidence != null ? String(entry.confidence) : "";
          break;
        case "occurredAt":
          values.occurredAt = entry.occurredAt ? new Date(entry.occurredAt).toISOString().slice(0, 10) : "";
          break;
      }
    } else {
      values[def.key] = fields[def.key] ?? "";
    }
  }
  return values;
}

export async function entriesInRange(start: Date, end: Date) {
  return prisma.entry.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Entries that happened on this calendar day in a previous year/period. */
export async function onThisDay() {
  const all = await prisma.entry.findMany({
    select: { id: true, type: true, title: true, summary: true, occurredAt: true, createdAt: true },
  });
  const now = new Date();
  return all
    .map((e) => ({ ...e, when: e.occurredAt ?? e.createdAt }))
    .filter(
      (e) =>
        e.when.getMonth() === now.getMonth() &&
        e.when.getDate() === now.getDate() &&
        e.when.getFullYear() !== now.getFullYear(),
    )
    .sort((a, b) => b.when.getTime() - a.when.getTime());
}

/**
 * Deterministically resurfaces a few lessons/insights each day so wisdom doesn't
 * get buried. Prefers entries older than two weeks, but falls back to whatever
 * lessons/aha/decisions exist — so a new user still gets value from day one.
 * The selection rotates by day but is stable within a day.
 */
export async function resurface(limit = 3) {
  const where = { type: { in: ["lesson", "aha", "decision"] } };
  const cutoff = new Date(Date.now() - 14 * 86_400_000);

  let pool = await prisma.entry.findMany({
    where: { ...where, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    include: { tags: { include: { tag: true } } },
  });

  // Not enough "aged" entries yet — fall back to all of them.
  if (pool.length < limit) {
    pool = await prisma.entry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tags: { include: { tag: true } } },
    });
  }
  if (pool.length === 0) return [];

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const picked = new Map<string, (typeof pool)[number]>();
  for (let i = 0; i < Math.min(limit, pool.length); i++) {
    const e = pool[(dayIndex + i) % pool.length];
    picked.set(e.id, e);
  }
  return [...picked.values()];
}
