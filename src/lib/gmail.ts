import { accessToken, googleConnected, googleEnabled, readState, writeState } from "@/lib/google";

// Gmail reader. OAuth/token lifecycle lives in google.ts (one Google connection
// powers both Gmail and Calendar). This module only reads recent mail so the
// assistant can surface commitments hiding in your inbox — read-only, never
// sends or modifies email.

const SEEN_KEY = "gmail:seen";

// Re-export connection state so existing callers keep working.
export const gmailEnabled = googleEnabled;
export const gmailConnected = googleConnected;

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
}

async function api<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function header(headers: { name: string; value: string }[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

interface GmailPayload {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPayload[];
}

// Walk the MIME tree for a text/plain part; fall back to stripping HTML.
function extractBody(payload: GmailPayload): string {
  const decode = (data?: string) => (data ? Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "");
  const walk = (part: GmailPayload, want: string): string => {
    if (part.mimeType === want && part.body?.data) return decode(part.body.data);
    for (const p of part.parts ?? []) {
      const found = walk(p, want);
      if (found) return found;
    }
    return "";
  };
  const plain = walk(payload, "text/plain");
  if (plain) return plain;
  const html = walk(payload, "text/html");
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fetch recent inbox messages worth scanning, biased toward mail likely to hold
 * action items, skipping any already processed.
 */
export async function fetchRecentMessages(opts: { days?: number; max?: number } = {}): Promise<EmailMessage[]> {
  const token = await accessToken();
  if (!token) return [];
  const days = opts.days ?? 7;
  const max = opts.max ?? 15;

  const q = encodeURIComponent(`newer_than:${days}d -category:promotions -category:social in:inbox`);
  const list = await api<{ messages?: { id: string }[] }>(`messages?q=${q}&maxResults=${max}`, token);
  const ids = (list?.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const seen = new Set((JSON.parse((await readState(SEEN_KEY)) ?? "[]") as string[]) ?? []);
  const fresh = ids.filter((id) => !seen.has(id));

  const out: EmailMessage[] = [];
  for (const id of fresh) {
    const msg = await api<{ snippet?: string; payload?: GmailPayload }>(`messages/${id}?format=full`, token);
    if (!msg?.payload) continue;
    out.push({
      id,
      from: header(msg.payload.headers, "From"),
      subject: header(msg.payload.headers, "Subject"),
      date: header(msg.payload.headers, "Date"),
      snippet: msg.snippet ?? "",
      body: extractBody(msg.payload).slice(0, 4000),
    });
  }
  return out;
}

/** Mark message ids as processed so future syncs don't re-handle them. */
export async function markSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const prev = (JSON.parse((await readState(SEEN_KEY)) ?? "[]") as string[]) ?? [];
  const merged = Array.from(new Set([...prev, ...ids])).slice(-500);
  await writeState(SEEN_KEY, JSON.stringify(merged));
}
