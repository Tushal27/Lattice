import { prisma } from "@/lib/db";

// Server-side durable memory. The assistant's rolling "working memory" — the
// gist of past conversations and useful facts about the user — now lives in the
// database instead of one device's localStorage, so continuity follows the user
// across every device. Single rolling document, capped, authoritative.

const KEY = "memory:rolling";
const CAP = 1500;

export async function getRollingMemory(): Promise<string> {
  const row = await prisma.appState.findUnique({ where: { key: KEY } });
  return row?.value ?? "";
}

export async function setRollingMemory(text: string): Promise<void> {
  const value = (text ?? "").slice(0, CAP);
  await prisma.appState.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
