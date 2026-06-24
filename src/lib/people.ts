import { extractPeople } from "@/lib/companion";
import { resolveContactEmail } from "@/lib/contacts";
import { prisma } from "@/lib/db";

// CRM-lite: a people index auto-derived from the user's entries. Each person
// aggregates a short "what I know" note plus the entries they came up in, so the
// assistant can recall the relationship before a meeting or email.

const SEEN_KEY = "people:seen";

export interface Mention {
  entryId: string;
  title: string;
}

export interface PersonRow {
  id: string;
  name: string;
  aka: string | null;
  summary: string | null;
  mentions: Mention[];
  weight: number;
  updatedAt: Date;
}

function parseMentions(raw: string | null): Mention[] {
  try {
    return (JSON.parse(raw ?? "[]") as Mention[]) ?? [];
  } catch {
    return [];
  }
}

export async function listPeople(limit = 100): Promise<PersonRow[]> {
  const rows = await prisma.person.findMany({ orderBy: [{ weight: "desc" }, { updatedAt: "desc" }], take: limit });
  return rows.map((p) => ({ ...p, mentions: parseMentions(p.mentions) }));
}

export async function getPerson(id: string): Promise<PersonRow | null> {
  const p = await prisma.person.findUnique({ where: { id } });
  return p ? { ...p, mentions: parseMentions(p.mentions) } : null;
}

export async function addPersonNote(id: string, note: string): Promise<void> {
  const p = await prisma.person.findUnique({ where: { id } });
  if (!p) return;
  const summary = [p.summary, note.trim()].filter(Boolean).join(" • ").slice(0, 800);
  await prisma.person.update({ where: { id }, data: { summary } });
}

export async function deletePerson(id: string): Promise<void> {
  await prisma.person.delete({ where: { id } }).catch(() => {});
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Merge extracted people into the store: dedupe by normalized name, grow the
// summary with new context, append the mention, and bump weight.
async function mergePerson(name: string, context: string, mention: Mention) {
  const all = await prisma.person.findMany({ select: { id: true, name: true, summary: true, mentions: true } });
  const hit = all.find((p) => norm(p.name) === norm(name));
  if (hit) {
    const mentions = parseMentions(hit.mentions);
    if (!mentions.some((m) => m.entryId === mention.entryId)) mentions.unshift(mention);
    const has = (hit.summary ?? "").toLowerCase();
    const summary = context && !has.includes(context.toLowerCase().slice(0, 30))
      ? [hit.summary, context].filter(Boolean).join(" • ").slice(0, 800)
      : hit.summary;
    await prisma.person.update({
      where: { id: hit.id },
      data: { summary, mentions: JSON.stringify(mentions.slice(0, 15)), weight: { increment: 1 } },
    });
  } else {
    const aka = await resolveContactEmail(name).catch(() => null);
    await prisma.person.create({
      data: { name: name.trim(), aka, summary: context || null, mentions: JSON.stringify([mention]) },
    });
  }
}

async function seenIds(): Promise<Set<string>> {
  const row = await prisma.appState.findUnique({ where: { key: SEEN_KEY } });
  try {
    return new Set((JSON.parse(row?.value ?? "[]") as string[]) ?? []);
  } catch {
    return new Set();
  }
}

/** Scan recent entries not yet processed, extract people, and merge them in. */
export async function ensurePeopleFromEntries(limit = 40): Promise<number> {
  const recent = await prisma.entry.findMany({
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true, type: true, title: true, summary: true, fields: true, createdAt: true },
  });
  const seen = await seenIds();
  const fresh = recent.filter((e) => !seen.has(e.id)).slice(0, limit);
  if (fresh.length === 0) return 0;

  const found = await extractPeople(fresh);
  const titleById = new Map(fresh.map((e) => [e.id, e.title]));
  for (const p of found) {
    await mergePerson(p.name, p.context, { entryId: p.entryId, title: titleById.get(p.entryId) ?? "" });
  }

  // Mark all scanned entries as processed (even those with no people) so we don't
  // re-scan them; cap the seen set.
  const merged = Array.from(new Set([...seen, ...fresh.map((e) => e.id)])).slice(-1000);
  await prisma.appState.upsert({
    where: { key: SEEN_KEY },
    create: { key: SEEN_KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return found.length;
}
