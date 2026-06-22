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

// ---- structured facts (memory beyond the rolling summary) ------------------

export interface Fact {
  id: string;
  content: string;
  kind: string;
  weight: number;
}

export async function listFacts(limit = 24): Promise<Fact[]> {
  return prisma.memory.findMany({
    orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, content: true, kind: true, weight: true },
  });
}

/** Add facts, deduping case-insensitively against existing ones (bumps weight
 *  on a repeat so things you keep mentioning rise to the top). */
export async function addFacts(contents: string[], kind = "fact"): Promise<number> {
  const existing = await prisma.memory.findMany({ select: { id: true, content: true } });
  const byNorm = new Map(existing.map((e) => [e.content.trim().toLowerCase(), e.id]));
  let added = 0;
  for (const raw of contents) {
    const content = raw.trim().slice(0, 240);
    if (content.length < 4) continue;
    const norm = content.toLowerCase();
    const hit = byNorm.get(norm);
    if (hit) {
      await prisma.memory.update({ where: { id: hit }, data: { weight: { increment: 1 } } });
    } else {
      const row = await prisma.memory.create({ data: { content, kind } });
      byNorm.set(norm, row.id);
      added++;
    }
  }
  // Keep the store bounded — drop the weakest, oldest beyond a cap.
  const count = await prisma.memory.count();
  if (count > 200) {
    const drop = await prisma.memory.findMany({
      orderBy: [{ weight: "asc" }, { createdAt: "asc" }],
      take: count - 200,
      select: { id: true },
    });
    await prisma.memory.deleteMany({ where: { id: { in: drop.map((d) => d.id) } } });
  }
  return added;
}

export async function deleteFact(id: string): Promise<void> {
  await prisma.memory.delete({ where: { id } }).catch(() => {});
}

/** A compact block of the strongest facts, for injecting into prompts. */
export async function factsBlock(limit = 16): Promise<string> {
  const facts = await listFacts(limit);
  if (facts.length === 0) return "";
  return facts.map((f) => `- ${f.content}`).join("\n");
}
