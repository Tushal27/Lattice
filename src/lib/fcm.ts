// Firebase Cloud Messaging — native push for the Android app. Optional by
// design, exactly like Web Push: with FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL
// + FIREBASE_PRIVATE_KEY set (from the service-account JSON), briefs and nudges
// reach the native app reliably; without them every function is a no-op.

import crypto from "crypto";
import type { PushPayload } from "@/lib/push";
import { prisma } from "@/lib/db";

const TOKENS_KEY = "fcm:tokens";

export function fcmEnabled(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}

async function readTokens(): Promise<string[]> {
  const row = await prisma.appState.findUnique({ where: { key: TOKENS_KEY } });
  try {
    return (JSON.parse(row?.value ?? "[]") as string[]).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeTokens(tokens: string[]): Promise<void> {
  const unique = [...new Set(tokens)].slice(-200);
  await prisma.appState.upsert({
    where: { key: TOKENS_KEY },
    create: { key: TOKENS_KEY, value: JSON.stringify(unique) },
    update: { value: JSON.stringify(unique) },
  });
}

export async function registerFcmToken(token: string): Promise<void> {
  const t = token.trim();
  if (!t) return;
  const tokens = await readTokens();
  if (!tokens.includes(t)) await writeTokens([...tokens, t]);
}

export async function fcmTokenCount(): Promise<number> {
  return (await readTokens()).length;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let cached: { token: string; exp: number } | null = null;

// Mint a short-lived OAuth access token from the service account (JWT-bearer).
async function accessToken(): Promise<string | null> {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!email || !rawKey) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const key = rawKey.replace(/\\n/g, "\n"); // env-escaped newlines
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  let signature: string;
  try {
    signature = signer.sign(key, "base64url");
  } catch {
    return null; // malformed private key
  }
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Send a notification to every registered device token; prune dead tokens. */
export async function sendFcmToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return { sent: 0, pruned: 0 };
  const token = await accessToken();
  if (!token) return { sent: 0, pruned: 0 };

  const tokens = await readTokens();
  if (tokens.length === 0) return { sent: 0, pruned: 0 };

  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    tokens.map(async (device) => {
      const message = {
        message: {
          token: device,
          notification: { title: payload.title, body: payload.body },
          data: {
            ...(payload.url ? { url: payload.url } : {}),
            ...(payload.entryId ? { entryId: payload.entryId } : {}),
          },
          android: { priority: "HIGH" as const, ...(payload.tag ? { notification: { tag: payload.tag } } : {}) },
        },
      };
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 400) dead.push(device); // unregistered/invalid
      } catch {
        /* transient — keep the token */
      }
    }),
  );
  if (dead.length) await writeTokens(tokens.filter((t) => !dead.includes(t)));
  return { sent, pruned: dead.length };
}
