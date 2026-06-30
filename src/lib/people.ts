import { extractPeople } from "@/lib/companion";
import { contactsDiagnostic, getContacts, matchContactEmail, resolveContactEmail } from "@/lib/contacts";
import { prisma } from "@/lib/db";
import { googleConnected } from "@/lib/google";

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
  /** Resolved sendable address (null = no email on file → not emailable). */
  email: string | null;
  summary: string | null;
  mentions: Mention[];
  weight: number;
  updatedAt: Date;
}

const isEmail = (s: string | null | undefined): s is string => !!s && /\S+@\S+\.\S+/.test(s);

function parseMentions(raw: string | null): Mention[] {
  try {
    return (JSON.parse(raw ?? "[]") as Mention[]) ?? [];
  } catch {
    return [];
  }
}

export async function listPeople(limit = 100): Promise<PersonRow[]> {
  const rows = await prisma.person.findMany({ orderBy: [{ weight: "desc" }, { updatedAt: "desc" }], take: limit });
  return rows.map((p) => ({ ...p, email: isEmail(p.aka) ? p.aka : null, mentions: parseMentions(p.mentions) }));
}

export async function getPerson(id: string): Promise<PersonRow | null> {
  const p = await prisma.person.findUnique({ where: { id } });
  return p ? { ...p, email: isEmail(p.aka) ? p.aka : null, mentions: parseMentions(p.mentions) } : null;
}

export interface ContactsState {
  /** Is a Google account linked at all (token present)? */
  googleConnected: boolean;
  /** Did we get a usable contact list to match against? */
  haveList: boolean;
  /** People-API HTTP status from a live probe (200 ok, 403 scope, 0 no token). */
  status: number;
  /** Saved ("My Contacts") count and auto-collected ("Other contacts") count. */
  saved: number;
  other: number;
  /** How many of the listed people we could resolve an email for. */
  matched: number;
}

/**
 * Fill in emails from Google Contacts for people who don't have one yet (e.g.
 * captured before Contacts was connected), persist the new matches, and report
 * the *real* contacts state — so the UI can tell apart "not connected",
 * "connected but no saved contacts", "permission missing", and "connected fine,
 * this person just isn't a contact".
 */
export async function attachEmails(
  people: PersonRow[],
): Promise<{ people: PersonRow[]; state: ContactsState }> {
  const contacts = await getContacts().catch(() => []);

  const backfill: { id: string; email: string }[] = [];
  const enriched = people.map((p) => {
    if (isEmail(p.email)) return p;
    const email = matchContactEmail(p.name, contacts);
    if (!email) return p;
    backfill.push({ id: p.id, email });
    return { ...p, email, aka: email };
  });
  if (backfill.length) {
    await Promise.all(
      backfill.map((b) => prisma.person.update({ where: { id: b.id }, data: { aka: b.email } }).catch(() => {})),
    );
  }
  const matched = enriched.filter((p) => isEmail(p.email)).length;

  // Happy path: we have a list, so Contacts is clearly working — no extra probe.
  if (contacts.length > 0) {
    return {
      people: enriched,
      state: { googleConnected: true, haveList: true, status: 200, saved: contacts.length, other: 0, matched },
    };
  }

  // No list came back — diagnose precisely instead of assuming "not connected".
  const connected = await googleConnected().catch(() => false);
  if (!connected) {
    return { people: enriched, state: { googleConnected: false, haveList: false, status: 0, saved: 0, other: 0, matched } };
  }
  const diag = await contactsDiagnostic().catch(() => ({ status: -1, count: 0, otherCount: 0 }));
  return {
    people: enriched,
    state: {
      googleConnected: true,
      haveList: diag.count > 0,
      status: diag.status,
      saved: diag.count,
      other: diag.otherCount,
      matched,
    },
  };
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
