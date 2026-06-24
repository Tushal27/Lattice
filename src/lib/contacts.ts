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

async function fetchContacts(): Promise<Contact[]> {
  const token = await accessToken();
  if (!token) return [];
  const out: Contact[] = [];
  let pageToken = "";
  for (let i = 0; i < 6; i++) {
    const params = new URLSearchParams({ personFields: "names,emailAddresses", pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      connections?: { names?: { displayName?: string }[]; emailAddresses?: { value?: string }[] }[];
      nextPageToken?: string;
    };
    for (const p of data.connections ?? []) {
      const name = p.names?.[0]?.displayName;
      const email = p.emailAddresses?.[0]?.value;
      if (name && email) out.push({ name, email });
    }
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

export async function getContacts(force = false): Promise<Contact[]> {
  if (!force) {
    const raw = await readState(CACHE_KEY);
    if (raw) {
      try {
        const c = JSON.parse(raw) as { at: number; list: Contact[] };
        if (c.at && Date.now() - c.at < TTL) return c.list;
      } catch {
        /* refetch */
      }
    }
  }
  const list = await fetchContacts();
  await writeState(CACHE_KEY, JSON.stringify({ at: Date.now(), list })).catch(() => {});
  return list;
}

/** Best-effort: resolve a name to a contact's email address. */
export async function resolveContactEmail(name: string): Promise<string | null> {
  const n = name.trim().toLowerCase();
  if (!n || n.includes("@")) return n.includes("@") ? name.trim() : null;
  const list = await getContacts();
  if (list.length === 0) return null;
  const first = n.split(" ")[0];
  return (
    list.find((c) => c.name.toLowerCase() === n)?.email ??
    list.find((c) => c.name.toLowerCase().split(" ")[0] === first)?.email ??
    list.find((c) => c.name.toLowerCase().includes(n))?.email ??
    null
  );
}
