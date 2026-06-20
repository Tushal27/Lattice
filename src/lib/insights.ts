// Proactive intelligence: turns the user's accumulated data into a small set of
// timely nudges ("this decision is ready to judge", "you keep returning to
// #pricing", "this question has gone quiet"). Triggers are computed
// deterministically from the data and persisted by a stable `key`, so dismissing
// one makes it stay gone, and a resolved condition clears itself automatically.

import { prisma } from "@/lib/db";
import { decisionsAwaitingReview } from "@/lib/entries";

const DAY = 86_400_000;

export interface InsightCandidate {
  key: string;
  type: string;
  title: string;
  body?: string | null;
  entityId?: string | null;
  priority: number;
}

export type InsightRow = Awaited<ReturnType<typeof activeInsights>>[number];

async function computeCandidates(): Promise<InsightCandidate[]> {
  const now = Date.now();
  const out: InsightCandidate[] = [];

  // 1. Decisions old enough to grade.
  const toReview = await decisionsAwaitingReview();
  for (const d of toReview.slice(0, 8)) {
    out.push({
      key: `decision-review:${d.id}`,
      type: "DecisionReviewReady",
      title: `Ready to judge: ${d.title}`,
      body: "Enough time has passed — how did this call actually turn out?",
      entityId: d.id,
      priority: 80,
    });
  }

  const [entries, commitments] = await Promise.all([
    prisma.entry.findMany({
      include: { tags: { include: { tag: true } }, children: { select: { id: true, createdAt: true } } },
    }),
    prisma.commitment.findMany({ select: { sourceId: true } }),
  ]);
  const committedSources = new Set(commitments.map((c) => c.sourceId).filter(Boolean) as string[]);
  const tagsOf = (e: (typeof entries)[number]) => e.tags.map((t) => t.tag.name);

  // 2. Open questions that have gone quiet.
  let forgotten = 0;
  for (const e of entries) {
    if (e.type !== "question" || (e.status ?? "open") === "answered") continue;
    const age = now - e.createdAt.getTime();
    if (age > 30 * DAY && forgotten < 5) {
      forgotten++;
      out.push({
        key: `forgotten-q:${e.id}`,
        type: "ForgottenQuestion",
        title: `Still open: ${e.title}`,
        body: `You asked this ${Math.round(age / DAY)} days ago. Found anything since?`,
        entityId: e.id,
        priority: 50,
      });
    }
  }

  // 3. Active projects with no recent movement.
  for (const e of entries) {
    if (e.type !== "project" || (e.status ?? "active") !== "active") continue;
    const lastTouch = e.children.reduce((m, c) => Math.max(m, c.createdAt.getTime()), e.updatedAt.getTime());
    if (now - lastTouch > 21 * DAY) {
      out.push({
        key: `project-stalled:${e.id}`,
        type: "ProjectStalled",
        title: `Stalled: ${e.title}`,
        body: `No activity in ${Math.round((now - lastTouch) / DAY)} days. Pick it back up or park it?`,
        entityId: e.id,
        priority: 45,
      });
    }
  }

  // 4. Recent decisions/lessons with no follow-through commitment yet.
  let opps = 0;
  const recentFirst = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const e of recentFirst) {
    if (opps >= 5) break;
    if (e.type !== "decision" && e.type !== "lesson") continue;
    if (now - e.createdAt.getTime() > 30 * DAY) continue;
    if (committedSources.has(e.id)) continue;
    opps++;
    out.push({
      key: `commitment-opp:${e.id}`,
      type: "CommitmentOpportunity",
      title: `Turn into action: ${e.title}`,
      body: e.type === "decision" ? "Schedule a review so this call gets graded." : "Set a reminder to actually apply this.",
      entityId: e.id,
      priority: 30,
    });
  }

  // 5 & 6. Tag-based patterns and emerging interests.
  const tagStat = new Map<string, { total: number; recent: number }>();
  for (const e of entries) {
    const recent = now - e.createdAt.getTime() <= 21 * DAY;
    for (const name of tagsOf(e)) {
      const s = tagStat.get(name) ?? { total: 0, recent: 0 };
      s.total++;
      if (recent) s.recent++;
      tagStat.set(name, s);
    }
  }
  for (const [name, s] of tagStat) {
    if (s.total >= 5) {
      out.push({
        key: `pattern:${name}`,
        type: "RepeatedPattern",
        title: `A recurring theme: #${name}`,
        body: `#${name} shows up across ${s.total} entries. There may be a deeper lesson worth naming.`,
        entityId: null,
        priority: 25,
      });
    }
    if (s.total >= 3 && s.recent >= 3 && s.recent / s.total >= 0.6) {
      out.push({
        key: `emerging:${name}`,
        type: "EmergingInterest",
        title: `Emerging interest: #${name}`,
        body: `${s.recent} of your last few weeks touch #${name}. Something is pulling your attention here.`,
        entityId: null,
        priority: 35,
      });
    }
  }

  // 7. Mistake warning: a brand-new entry echoing an older lesson (shared tags).
  const oldLessons = entries.filter(
    (e) => e.type === "lesson" && now - e.createdAt.getTime() > 30 * DAY && tagsOf(e).length > 0,
  );
  const fresh = entries.filter((e) => now - e.createdAt.getTime() <= 7 * DAY && e.type !== "lesson");
  let warned = 0;
  for (const e of fresh) {
    if (warned >= 3) break;
    const eTags = new Set(tagsOf(e));
    if (eTags.size === 0) continue;
    const match = oldLessons.find((l) => tagsOf(l).filter((t) => eTags.has(t)).length >= 2);
    if (match) {
      warned++;
      out.push({
        key: `mistake:${e.id}`,
        type: "MistakeWarning",
        title: `Heads up — you've been here before`,
        body: `“${e.title}” overlaps a past lesson: “${match.title}”. Worth a look before you repeat it.`,
        entityId: match.id,
        priority: 60,
      });
    }
  }

  return out;
}

/**
 * Recompute triggers and reconcile with what's stored: create new ones, refresh
 * the text of active ones, never resurrect dismissed ones, and delete active
 * ones whose underlying condition no longer holds.
 */
export async function refreshInsights() {
  const candidates = await computeCandidates();
  const validKeys = candidates.map((c) => c.key);

  for (const c of candidates) {
    const existing = await prisma.insightTrigger.findUnique({ where: { key: c.key } });
    if (!existing) {
      await prisma.insightTrigger.create({
        data: { key: c.key, type: c.type, title: c.title, body: c.body ?? null, entityId: c.entityId ?? null, priority: c.priority },
      });
    } else if (existing.status === "active") {
      await prisma.insightTrigger.update({
        where: { key: c.key },
        data: { title: c.title, body: c.body ?? null, priority: c.priority, type: c.type, entityId: c.entityId ?? null },
      });
    }
    // dismissed / acted: leave untouched.
  }

  // Clear active triggers that are no longer valid (e.g. the decision got reviewed).
  await prisma.insightTrigger.deleteMany({
    where: { status: "active", key: validKeys.length ? { notIn: validKeys } : undefined },
  });

  return activeInsights();
}

export async function activeInsights(limit = 12) {
  return prisma.insightTrigger.findMany({
    where: { status: "active" },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function dismissInsight(id: string) {
  return prisma.insightTrigger.update({ where: { id }, data: { status: "dismissed" } });
}

export async function actOnInsight(id: string) {
  return prisma.insightTrigger.update({ where: { id }, data: { status: "acted" } });
}
