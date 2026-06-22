import { prisma } from "@/lib/db";

// Gmail connector. Entirely optional and inert until Google OAuth credentials
// are configured — mirroring how Web Push stays dormant without VAPID keys.
// Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (and optionally GMAIL_REDIRECT_URI)
// to switch it on. Read-only scope: Lattice reads recent mail to surface
// commitments/decisions hiding in your inbox; it never sends or modifies email.

const TOKEN_KEY = "gmail:token";
const SEEN_KEY = "gmail:seen";

// Read-only: we only ever read message metadata + bodies, never modify.
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function gmailEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return process.env.GMAIL_REDIRECT_URI || `${origin}/api/gmail/callback`;
}

export function authUrl(origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // get a refresh token
    prompt: "consent", // force refresh-token issuance on reconnect
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenBundle {
  access_token: string;
  refresh_token?: string;
  expiry: number; // epoch ms
  email?: string;
}

async function readState(key: string): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function loadToken(): Promise<TokenBundle | null> {
  const raw = await readState(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenBundle;
  } catch {
    return null;
  }
}

async function saveToken(t: TokenBundle): Promise<void> {
  await writeState(TOKEN_KEY, JSON.stringify(t));
}

export async function gmailConnected(): Promise<boolean> {
  const t = await loadToken();
  return Boolean(t?.refresh_token || (t?.access_token && t.expiry > Date.now()));
}

export async function gmailAccountEmail(): Promise<string | null> {
  return (await loadToken())?.email ?? null;
}

export async function disconnectGmail(): Promise<void> {
  await prisma.appState.deleteMany({ where: { key: { in: [TOKEN_KEY, SEEN_KEY] } } });
}

/** Exchange an OAuth authorization code for tokens and persist them. */
export async function exchangeCode(code: string, origin: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };

  const bundle: TokenBundle = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
  bundle.email = (await fetchProfileEmail(bundle.access_token)) ?? undefined;
  await saveToken(bundle);
}

async function fetchProfileEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { emailAddress?: string };
    return data.emailAddress ?? null;
  } catch {
    return null;
  }
}

/** A valid access token, refreshing transparently when it's expired. */
async function accessToken(): Promise<string | null> {
  const t = await loadToken();
  if (!t) return null;
  if (t.access_token && t.expiry > Date.now()) return t.access_token;
  if (!t.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: t.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const refreshed: TokenBundle = {
    ...t,
    access_token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
  await saveToken(refreshed);
  return refreshed.access_token;
}

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

interface GmailPayload {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPayload[];
}

/**
 * Fetch recent inbox messages worth scanning. We bias toward mail likely to
 * contain action items (primary category, newer than the window), skipping any
 * we've already processed.
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
  const merged = Array.from(new Set([...prev, ...ids])).slice(-500); // cap
  await writeState(SEEN_KEY, JSON.stringify(merged));
}
