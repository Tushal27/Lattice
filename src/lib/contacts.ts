import { accessToken, readState, writeState } from "@/lib/google";

// Google Contacts (People API) — read-only. Powers recipient resolution ("email
// John" → John's address) and enriches CRM-lite people with real emails. The
// list is cached for a day so we don't hit the API on every lookup.

const CACHE_KEY = "google:contacts";
const TTL = 24 * 3600 * 1000;

export interface Contact {
  name: string;
  email: string;
}

interface ApiPerson {
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
}

function collect(into: Map<string, Contact>, people: ApiPerson[]) {
  for (const p of people) {
    const name = p.names?.[0]?.displayName;
    const email = p.emailAddresses?.[0]?.value;
    if (name && email && !into.has(email.toLowerCase())) into.set(email.toLowerCase(), { name, email });
  }
}

async function fetchContacts(): Promise<Contact[]> {
  const token = await accessToken();
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const byEmail = new Map<string, Contact>();

  // 1. Saved contacts ("My Contacts").
  let pageToken = "";
  for (let i = 0; i < 6; i++) {
    const params = new URLSearchParams({ personFields: "names,emailAddresses", pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as { connections?: ApiPerson[]; nextPageToken?: string };
    collect(byEmail, data.connections ?? []);
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  // 2. Auto-collected "Other contacts" (from your mail). Needs the
  // contacts.other.readonly scope — skipped silently (4xx) until it's granted.
  pageToken = "";
  for (let i = 0; i < 6; i++) {
    const params = new URLSearchParams({ readMask: "names,emailAddresses", pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://people.googleapis.com/v1/otherContacts?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as { otherContacts?: ApiPerson[]; nextPageToken?: string };
    collect(byEmail, data.otherContacts ?? []);
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return [...byEmail.values()];
}

export async function getContacts(force = false): Promise<Contact[]> {
  if (!force) {
    const raw = await readState(CACHE_KEY);
    if (raw) {
      try {
        const c = JSON.parse(raw) as { at: number; list: Contact[] };
        // Only trust a NON-empty fresh cache. An empty cache (e.g. written while
        // the People API was disabled) is ignored so we re-fetch and self-heal.
        if (c.at && c.list?.length > 0 && Date.now() - c.at < TTL) return c.list;
      } catch {
        /* refetch */
      }
    }
  }
  const list = await fetchContacts();
  if (list.length > 0) await writeState(CACHE_KEY, JSON.stringify({ at: Date.now(), list })).catch(() => {});
  return list;
}

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "sir", "madam", "mx"]);

// Normalize a name for matching: drop punctuation (so "S. Jagan" == "S Jagan"),
// lowercase, collapse spaces.
const cleanName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Meaningful name tokens (honorifics dropped) — so "Dr. S jagan" → ["s","jagan"].
const nameTokens = (s: string) => cleanName(s).split(" ").filter((t) => t && !HONORIFICS.has(t));

/**
 * Match a spoken name against an already-loaded contact list, tolerant of
 * honorifics, initials, dots, and word order ("Dr. S jagan" → "Dr. S. Jagan
 * Raj"). Pure, so it can be reused across many names without re-reading the
 * cache. Returns null rather than guessing when a multi-word name has no
 * confident match — so the assistant leaves it for the user instead of sending
 * to the wrong person.
 */
export function matchContactEmail(name: string, list: Contact[]): string | null {
  const raw = name.trim();
  if (raw.includes("@")) return raw;
  const n = cleanName(raw);
  if (!n || list.length === 0) return null;
  const q = nameTokens(raw);
  if (q.length === 0) return null;

  // 1. Exact / substring on the full cleaned name (either direction).
  const exact = list.find((c) => cleanName(c.name) === n);
  if (exact) return exact.email;
  const sub = list.find((c) => {
    const cn = cleanName(c.name);
    return cn.includes(n) || n.includes(cn);
  });
  if (sub) return sub.email;

  // 2. Every query token appears in the contact's tokens ("s jagan" ⊆ "s jagan raj").
  const all = list.find((c) => {
    const ct = new Set(nameTokens(c.name));
    return q.every((t) => ct.has(t));
  });
  if (all) return all.email;

  // 3. Single-word query (a first name like "Priyanka"): match on any token.
  //    Multi-word names without a full match stay unresolved on purpose.
  if (q.length === 1) {
    const t = q[0];
    const hit =
      list.find((c) => nameTokens(c.name).includes(t)) ??
      list.find((c) => cleanName(c.name).includes(t));
    if (hit) return hit.email;
  }
  return null;
}

/** Best-effort: resolve a name to a contact's email address. */
export async function resolveContactEmail(name: string): Promise<string | null> {
  const n = name.trim();
  if (n.includes("@")) return n;
  return matchContactEmail(n, await getContacts());
}

/** Is this exact email address one of the user's saved contacts? */
export async function contactHasEmail(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  return (await getContacts()).some((c) => c.email.toLowerCase() === e);
}

/** One live People-API call that reports the HTTP status — so we can tell a
 *  permission/API problem (403) apart from genuinely-empty saved contacts (200). */
export async function contactsDiagnostic(): Promise<{ status: number; count: number; otherCount: number }> {
  const token = await accessToken();
  if (!token) return { status: 0, count: 0, otherCount: 0 };
  const headers = { Authorization: `Bearer ${token}` };

  let status = 0;
  let count = 0;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=50",
      { headers, signal: AbortSignal.timeout(15000) },
    );
    status = res.status;
    if (res.ok) {
      const d = (await res.json()) as { connections?: unknown[] };
      count = (d.connections ?? []).length;
    }
  } catch {
    status = -1;
  }

  // "Other contacts" (auto-collected from your mail) — separate scope; if it
  // works it dramatically widens who we can resolve.
  let otherCount = 0;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses&pageSize=50",
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (res.ok) {
      const d = (await res.json()) as { otherContacts?: unknown[] };
      otherCount = (d.otherContacts ?? []).length;
    }
  } catch {
    /* ignore */
  }
  return { status, count, otherCount };
}
