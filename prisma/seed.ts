// Seeds Lattice with a small, realistic set of entries so the UI feels alive on
// first run and the connection/suggestion features have something to work with.
// Run with: npm run db:seed

import { prisma } from "../src/lib/db";
import { addConnection, createEntry, type EntryInput } from "../src/lib/entries";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function add(input: EntryInput, createdAt?: Date) {
  const entry = await createEntry(input);
  if (createdAt) {
    await prisma.entry.update({ where: { id: entry.id }, data: { createdAt } });
  }
  return entry.id;
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.connection.deleteMany();
  await prisma.entryTag.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.tag.deleteMany();

  console.log("Seeding…");

  const project = await add({
    type: "project",
    title: "Lattice",
    status: "active",
    summary: "A personal operating system where knowledge compounds over years.",
    occurredAt: daysAgo(60),
    tags: ["lattice", "product"],
    fields: {
      goal: "A second brain that captures how I think, decide, and grow — not a task manager.",
      reflection: "The hardest part isn't features, it's making reflection a habit.",
    },
  });

  const decArch = await add(
    {
      type: "decision",
      title: "Build Lattice on Next.js + SQLite",
      summary: "One self-contained app, no external services to run.",
      confidence: 80,
      projectId: project,
      occurredAt: daysAgo(45),
      tags: ["architecture", "lattice"],
      fields: {
        context: "I want something I'll actually run for years without ops overhead.",
        options: "Next.js + SQLite · a SPA with a separate API · a hosted no-code tool.",
        reasoning: "Fewest moving parts; everything lives in one deployable, local-first app.",
        expected: "Fast iteration and zero infra babysitting.",
      },
    },
    daysAgo(45),
  );

  const decAI = await add({
    type: "decision",
    title: "Keep the AI layer provider-agnostic",
    summary: "Call the model over plain HTTP and degrade gracefully without a key.",
    confidence: 70,
    projectId: project,
    occurredAt: daysAgo(20),
    tags: ["architecture", "ai"],
    fields: {
      context: "The thinking-partner features shouldn't be load-bearing for basic use.",
      reasoning: "If the app is useless without an API key, I'll stop using it on bad days.",
      expected: "The app stays fully usable offline; AI just sharpens it.",
      reviewOutcome: "Worked out — every AI feature has a local fallback and the app never blocks.",
      reviewVerdict: "Right call",
      reviewLearning: "Designing for the no-AI path first made the AI path cleaner too.",
    },
  });

  const lessonDocs = await add({
    type: "lesson",
    title: "Read the installed version's docs before coding a new framework",
    summary: "Next 16 and Prisma 7 both had breaking changes from what I expected.",
    projectId: project,
    occurredAt: daysAgo(44),
    tags: ["architecture", "learning"],
    fields: {
      category: "Technical",
      whatHappened: "Assumed APIs matched what I'd seen before; several didn't.",
      rootCause: "Trusted memory over the actual installed version.",
      lesson: "Verify against node_modules, not recollection.",
      prevention: "Skim the bundled docs/changelog before writing the first line.",
    },
  });

  const lessonSmall = await add({
    type: "lesson",
    title: "Ship the smallest version that teaches you something",
    summary: "A real foundation beats a broad, shallow scaffold.",
    occurredAt: daysAgo(15),
    tags: ["product", "learning"],
    fields: {
      category: "Product",
      whatHappened: "Wanted to build every area at once.",
      lesson: "Depth in a few areas reveals the right shape for the rest.",
      prevention: "Pick a vertical slice and make it genuinely good.",
    },
  });

  const ahaModel = await add({
    type: "aha",
    title: "Everything is an Entry — one model, many shapes",
    summary: "Decisions, lessons, questions and projects share a spine.",
    projectId: project,
    occurredAt: daysAgo(40),
    tags: ["architecture", "design"],
    fields: {
      trigger: "Trying to design separate tables for each area.",
      detail: "A single Entry with a type + JSON fields makes cross-area connections trivial.",
    },
  });

  const ahaConnections = await add({
    type: "aha",
    title: "Connections matter more than the notes themselves",
    summary: "Value lives in the edges of the graph, not the nodes.",
    occurredAt: daysAgo(10),
    tags: ["knowledge", "design"],
    fields: {
      trigger: "Re-reading old notes that felt isolated and dead.",
      detail: "A lesson linked to a decision and a question becomes wisdom; alone it's trivia.",
    },
  });

  const qGraph = await add({
    type: "question",
    title: "How do knowledge graphs actually improve recall over time?",
    status: "open",
    occurredAt: daysAgo(12),
    tags: ["knowledge", "lattice"],
    fields: { why: "It's the core bet behind Lattice's connections." },
  });

  await add({
    type: "question",
    title: "What makes a second brain one you actually keep using?",
    status: "exploring",
    occurredAt: daysAgo(5),
    tags: ["product"],
    fields: {
      why: "Most note systems are abandoned within weeks.",
      answer: "Early hunch: low-friction capture + reflection that resurfaces the past.",
    },
  });

  console.log("Linking connections…");
  await addConnection(decArch, lessonDocs, "The lesson came directly out of making this call.");
  await addConnection(decArch, ahaModel);
  await addConnection(ahaConnections, qGraph);
  await addConnection(decAI, lessonSmall);

  const count = await prisma.entry.count();
  console.log(`Done. ${count} entries seeded.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
