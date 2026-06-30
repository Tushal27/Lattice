import { prisma } from "@/lib/db";

// Shared Google OAuth core. One consent grants Lattice everything it needs from
// Google — read-only Gmail (capture action items) and read/write Calendar
// (awareness + scheduling). Inert until GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
// are set, exactly like Web Push without VAPID keys.
//
// gmail.ts and calendar.ts are thin consumers of this module.

const TOKEN_KEY = "google:token";
const LEGACY_TOKEN_KEY = "gmail:token"; // migrate the earlier Gmail-only grant

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  // send-only: lets Lattice send mail you compose, but not read/modify beyond that.
  "https://www.googleapis.com/auth/gmail.send",
  // events scope covers reading and writing the user's calendar events.
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  // read-only contacts: resolve "email John" to John's address + enrich people.
  "https://www.googleapis.com/auth/contacts.readonly",
  // auto-collected "Other contacts" (harvested from your mail) — this is where
  // most people you email actually live, even when they're not saved contacts.
  "https://www.googleapis.com/auth/contacts.other.readonly",
];

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || process.env.GMAIL_REDIRECT_URI || `${origin}/api/google/callback`;
}

export function authUrl(origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
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

export async function readState(key: string): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function writeState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function loadToken(): Promise<TokenBundle | null> {
  let raw = await readState(TOKEN_KEY);
  if (!raw) raw = await readState(LEGACY_TOKEN_KEY); // one-time migration read
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

export async function googleConnected(): Promise<boolean> {
  const t = await loadToken();
  return Boolean(t?.refresh_token || (t?.access_token && t.expiry > Date.now()));
}

export async function googleEmail(): Promise<string | null> {
  return (await loadToken())?.email ?? null;
}

export async function disconnectGoogle(): Promise<void> {
  await prisma.appState.deleteMany({
    where: { key: { in: [TOKEN_KEY, LEGACY_TOKEN_KEY, "gmail:seen"] } },
  });
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

async function fetchProfileEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/** A valid access token, refreshing transparently when expired. */
export async function accessToken(): Promise<string | null> {
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
  const refreshed: TokenBundle = { ...t, access_token: data.access_token, expiry: Date.now() + (data.expires_in - 60) * 1000 };
  await saveToken(refreshed);
  return refreshed.access_token;
}
