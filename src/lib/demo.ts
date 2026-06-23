import { logAction } from "@/lib/capabilities";
import { createCommitment } from "@/lib/commitments";
import { prisma } from "@/lib/db";
import { refreshInsights } from "@/lib/insights";
import { addFacts } from "@/lib/memory";

// Founder Demo Mode — seeds a coherent, realistic "founder's brain" so every
// surface comes alive at once: the core loop (capture → connect → recall → act →
// learn), a live MistakeWarning, decision calibration, money judgment, autonomy
// history, and ingestion provenance. Reversible: everything is tracked and can
// be cleared, so it never pollutes real data.

const MANIFEST_KEY = "demo:manifest";

interface Manifest {
  entries: string[];
  commitments: string[];
  facts: string[]; // memory ids
  actions: string[];
  sources: string[];
}

const day = 86_400_000;

async function getManifest(): Promise<Manifest | null> {
  const row = await prisma.appState.findUnique({ where: { key: MANIFEST_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Manifest;
  } catch {
    return null;
  }
}

export async function demoLoaded(): Promise<boolean> {
  return (await getManifest()) !== null;
}

interface SeedEntry {
  type: string;
  title: string;
  summary?: string;
  status?: string;
  confidence?: number;
  fields?: Record<string, unknown>;
  daysAgo?: number;
  tags?: string[];
  projectId?: string;
}

export async function seedDemo(): Promise<{ ok: boolean; created?: number; already?: boolean }> {
  if (await demoLoaded()) return { ok: true, already: true };

  const entryIds: string[] = [];
  const tagOf = (name: string) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } });

  async function mk(e: SeedEntry): Promise<string> {
    const at = new Date(Date.now() - (e.daysAgo ?? 0) * day);
    const row = await prisma.entry.create({
      data: {
        type: e.type,
        title: e.title,
        summary: e.summary ?? null,
        status: e.status ?? null,
        confidence: e.confidence ?? null,
        fields: e.fields ? JSON.stringify(e.fields) : null,
        createdAt: at,
        updatedAt: at,
        occurredAt: at,
        projectId: e.projectId ?? null,
        tags: e.tags?.length ? { create: e.tags.map(tagOf) } : undefined,
      },
    });
    entryIds.push(row.id);
    return row.id;
  }

  // ---- the narrative -------------------------------------------------------
  const project = await mk({
    type: "project",
    title: "Lattice — a personal AI operating system",
    summary: "A second brain where decisions, lessons, and judgment compound over years.",
    status: "active",
    daysAgo: 90,
    tags: ["lattice", "product"],
  });

  // The lesson that will later fire a MistakeWarning (predates the new decision,
  // shares vocabulary so even the lexical path catches it).
  await mk({
    type: "lesson",
    title: "Measure before you migrate infrastructure",
    summary: "Our “the database is slow” pain was N+1 queries in app code, not Postgres. Migrating the DB would have wasted a month.",
    daysAgo: 35,
    tags: ["engineering", "performance", "database"],
  });

  // A fresh decision that echoes the past mistake → MistakeWarning.
  await mk({
    type: "decision",
    title: "Move off Postgres to a new database because the app feels slow",
    summary: "Considering migrating our database again since things feel slow under load.",
    confidence: 65,
    fields: {
      context: "Dashboards feel sluggish during peak usage.",
      reasoning: "A faster database might fix the latency.",
      expected: "Lower p99 latency after the migration.",
    },
    daysAgo: 0,
    tags: ["engineering", "database", "performance"],
  });

  // Reviewed decisions → powers calibration + judgment analysis (needs ≥3).
  await mk({
    type: "decision",
    title: "Raise a small angel round instead of bootstrapping further",
    summary: "Take ~$150k angel money to hire one engineer and extend runway.",
    confidence: 80,
    fields: {
      reasoning: "Speed to PMF matters more than dilution at this stage.",
      expected: "Ship 2x faster, reach PMF signals within 6 months.",
      reviewOutcome: "Hire shipped the data layer in weeks; runway doubled.",
      reviewVerdict: "Right call",
      wouldRepeat: "Yes",
      reviewLearning: "Small, surgical capital beats a big raise pre-PMF.",
    },
    daysAgo: 60,
    tags: ["fundraising", "strategy"],
  });
  await mk({
    type: "decision",
    title: "Hire a senior engineer before product-market fit",
    summary: "Bring on a senior eng to move faster.",
    confidence: 55,
    fields: {
      reasoning: "More hands = more speed.",
      expected: "Faster shipping across the board.",
      reviewOutcome: "Helped on infra but added process overhead while still searching for PMF.",
      reviewVerdict: "Mixed",
      wouldRepeat: "Not sure",
      reviewLearning: "Pre-PMF, hire for a specific bottleneck, not general speed.",
    },
    daysAgo: 75,
    tags: ["hiring", "strategy"],
  });
  await mk({
    type: "decision",
    title: "Rewrite the frontend in a new framework mid-sprint",
    summary: "Switch frameworks to feel more modern.",
    confidence: 70,
    fields: {
      reasoning: "Newer stack, better DX.",
      expected: "Cleaner code, faster future work.",
      reviewOutcome: "Cost two weeks and shipped no user value.",
      reviewVerdict: "Wrong call",
      wouldRepeat: "No",
      reviewLearning: "Don't refactor toward novelty mid-sprint — tie rewrites to user value.",
    },
    daysAgo: 50,
    tags: ["engineering", "process"],
  });

  // Decisions old enough to be "ready to judge" (no verdict yet).
  await mk({
    type: "decision",
    title: "Make the assistant act autonomously, gated by a trust dial",
    summary: "Let Lattice take actions (schedule, capture) on a per-capability Off/Ask/Auto setting.",
    confidence: 75,
    fields: { reasoning: "Autonomy is only safe if it's permissioned and audited.", expected: "Users trust it because every action is logged and reversible." },
    daysAgo: 20,
    tags: ["ai", "autonomy", "product"],
    projectId: project,
  });

  await mk({
    type: "aha",
    title: "My bottleneck shifted from implementation to problem selection",
    summary: "With AI, the leverage is choosing the right problem and owning the end-to-end flow — not raw coding.",
    daysAgo: 12,
    tags: ["meta", "leverage", "ai"],
    projectId: project,
  });
  const lessonSystems = await mk({
    type: "lesson",
    title: "Engineering is increasingly about systems, not code",
    summary: "API contracts, data flow, and trust boundaries are where the real work is now.",
    daysAgo: 18,
    tags: ["engineering", "systems"],
  });
  await mk({
    type: "question",
    title: "What makes an early-stage AI product genuinely defensible?",
    status: "open",
    summary: "Is it the data moat, the workflow lock-in, or the compounding personal context?",
    daysAgo: 8,
    tags: ["strategy", "moat", "ai"],
  });

  // Engineering OS — an architecture decision (ADR) that ties to the systems lesson.
  const adr = await mk({
    type: "architecture",
    title: "Use libSQL/Turso for persistence",
    summary: "One adapter for local SQLite and hosted Turso — phone-only deploys, no migration step.",
    status: "accepted",
    fields: {
      context: "Single-user app that must deploy from a phone with zero ops.",
      decision: "libSQL via Prisma adapter; schema created idempotently on boot.",
      alternatives: "Postgres (more ops), Mongo (wrong shape for a graph).",
      consequences: "Trivial deploys; SQLite limits accepted at this scale.",
    },
    daysAgo: 40,
    tags: ["engineering", "architecture", "database"],
    projectId: project,
  });

  // Money OS — judgment, not bookkeeping.
  await mk({ type: "expense", title: "Standing desk", summary: "Better focus and fewer back issues.", fields: { amount: 18000, category: "Health", recurring: "one-time", satisfaction: "Great" }, daysAgo: 22, tags: ["health"] });
  await mk({ type: "expense", title: "Notion subscription I never opened", summary: "Paid monthly, used it twice.", fields: { amount: 800, category: "Tools/Software", recurring: "monthly", satisfaction: "Regret" }, daysAgo: 15, tags: ["tools", "subscription"] });
  await mk({ type: "expense", title: "Conference ticket", summary: "Two strong connections came out of it.", fields: { amount: 12000, category: "Experiences", recurring: "one-time", satisfaction: "Worth it" }, daysAgo: 30, tags: ["network"] });
  await mk({
    type: "investment",
    title: "Index fund SIP",
    summary: "Monthly auto-invest into a broad index.",
    status: "active",
    fields: { amount: 8000, frequency: "monthly", expectedReturn: 11, thesis: "Time in market beats timing it.", horizon: "10+ years", risk: "Medium" },
    daysAgo: 45,
    tags: ["investing"],
  });
  await mk({
    type: "goal",
    title: "6-month emergency fund",
    summary: "Runway that lets me make brave calls.",
    status: "active",
    fields: { amount: 600000, current: 90000, monthly: 8000, expectedReturn: 6, deadline: new Date(Date.now() + 300 * day).toISOString().slice(0, 10) },
    daysAgo: 28,
    tags: ["safety", "money"],
  });

  // ---- connections (the graph builds itself, shown explicitly here) --------
  const connect = async (fromId: string, toId: string, note: string) => {
    await prisma.connection.create({ data: { fromId, toId, note } }).catch(() => {});
  };
  await connect(lessonSystems, adr, "the ADR is this lesson made concrete");
  await connect(adr, project, "foundational decision for the product");

  // ---- commitments (action) ------------------------------------------------
  const commitmentIds: string[] = [];
  const c1 = await createCommitment({ title: "Review the angel-round decision — did the bet pay off?", dueDate: new Date(Date.now() - day), sourceType: "decision" });
  const c2 = await createCommitment({ title: "Ship the Lattice founder demo", dueDate: new Date() });
  const c3 = await createCommitment({ title: "Meditate every morning", dueDate: new Date(Date.now() + day), recurringRule: "daily" });
  commitmentIds.push(c1.id, c2.id, c3.id);

  // ---- durable memory (recall) --------------------------------------------
  await addFacts([
    "Building Lattice, a personal AI operating system",
    "Long-term goal: become a Staff/Principal engineer or found a company",
    "Prefers concise, direct answers and ownership over busywork",
    "Believes leverage now comes from problem selection, not raw implementation",
  ]);
  const facts = await prisma.memory.findMany({ select: { id: true } });
  const factIds = facts.map((f) => f.id);

  // ---- autonomy history (act + report) ------------------------------------
  await logAction({ capability: "autonomy.schedule_reviews", summary: "Scheduled a review block: angel-round decision", reason: "Decided 60 days ago and still ungraded — past the review window, so its outcome is worth judging now.", source: "autonomous" });
  await logAction({ capability: "gmail.capture", summary: "From email → commitment: send the investor update", reason: "A recent email contained a concrete action item you'd otherwise have to track manually.", source: "gmail" });
  await logAction({ capability: "url.ingest", summary: "Captured from url: How marketplaces bootstrap supply", reason: "You shared a link; it was distilled into a note and linked into your graph.", source: "url" });
  const actions = await prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: 3, select: { id: true } });
  const actionIds = actions.map((a) => a.id);

  // ---- ingestion provenance ------------------------------------------------
  const s1 = await prisma.source.create({ data: { provider: "url", externalId: "https://example.com/marketplaces", title: "How marketplaces bootstrap supply" } });
  const s2 = await prisma.source.create({ data: { provider: "github", externalId: `github:demo:${new Date().toISOString().slice(0, 10)}`, title: "Engineering activity — this week" } });

  const manifest: Manifest = { entries: entryIds, commitments: commitmentIds, facts: factIds, actions: actionIds, sources: [s1.id, s2.id] };
  await prisma.appState.upsert({ where: { key: MANIFEST_KEY }, create: { key: MANIFEST_KEY, value: JSON.stringify(manifest) }, update: { value: JSON.stringify(manifest) } });

  // Compute insights from the seeded data (MistakeWarning, GoalRisk, etc.).
  await refreshInsights({ force: true }).catch(() => {});

  return { ok: true, created: entryIds.length };
}

export async function clearDemo(): Promise<{ ok: boolean }> {
  const m = await getManifest();
  if (!m) return { ok: true };
  // Insights referencing demo entries, then the entries (cascades tags/connections).
  await prisma.insightTrigger.deleteMany({ where: { entityId: { in: m.entries } } }).catch(() => {});
  await prisma.entry.deleteMany({ where: { id: { in: m.entries } } }).catch(() => {});
  await prisma.commitment.deleteMany({ where: { id: { in: m.commitments } } }).catch(() => {});
  await prisma.memory.deleteMany({ where: { id: { in: m.facts } } }).catch(() => {});
  await prisma.actionLog.deleteMany({ where: { id: { in: m.actions } } }).catch(() => {});
  await prisma.source.deleteMany({ where: { id: { in: m.sources } } }).catch(() => {});
  await prisma.appState.delete({ where: { key: MANIFEST_KEY } }).catch(() => {});
  await refreshInsights({ force: true }).catch(() => {});
  return { ok: true };
}
