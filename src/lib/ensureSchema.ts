import { prisma } from "@/lib/db";

// Creates Lattice's tables if they don't exist yet. This lets a fresh hosted
// database (e.g. an empty Turso instance) become ready on first server boot,
// with no terminal/migration step required — which makes deploying entirely
// from a phone possible. Every statement is idempotent (`IF NOT EXISTS`), so
// running it against an already-migrated local database is a harmless no-op.

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT,
    "confidence" INTEGER,
    "fields" TEXT,
    "occurredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT,
    CONSTRAINT "Entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Entry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "EntryTag" (
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("entryId", "tagId"),
    CONSTRAINT "EntryTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Entry_type_idx" ON "Entry"("type")`,
  `CREATE INDEX IF NOT EXISTS "Entry_occurredAt_idx" ON "Entry"("occurredAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name")`,
  `CREATE INDEX IF NOT EXISTS "EntryTag_tagId_idx" ON "EntryTag"("tagId")`,
  `CREATE INDEX IF NOT EXISTS "Connection_toId_idx" ON "Connection"("toId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Connection_fromId_toId_key" ON "Connection"("fromId", "toId")`,
  `CREATE TABLE IF NOT EXISTS "Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "recurringRule" TEXT,
    "priority" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Commitment_status_idx" ON "Commitment"("status")`,
  `CREATE INDEX IF NOT EXISTS "Commitment_dueDate_idx" ON "Commitment"("dueDate")`,
];

let done: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Memoize so concurrent callers share one run per server instance.
  if (!done) {
    done = (async () => {
      for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
      }
    })().catch((err) => {
      // Reset so a later request can retry, but never crash the server.
      done = null;
      console.error("ensureSchema failed", err);
    });
  }
  return done;
}
