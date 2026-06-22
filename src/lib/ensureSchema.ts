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
    "embedding" TEXT,
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
  `CREATE TABLE IF NOT EXISTS "InsightTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "InsightTrigger_key_key" ON "InsightTrigger"("key")`,
  `CREATE INDEX IF NOT EXISTS "InsightTrigger_status_idx" ON "InsightTrigger"("status")`,
  `CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
  `CREATE TABLE IF NOT EXISTS "AppState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "source" TEXT NOT NULL DEFAULT 'agent',
    "entityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "ActionLog_createdAt_idx" ON "ActionLog"("createdAt")`,
  // For databases created before the embedding column existed. SQLite has no
  // "ADD COLUMN IF NOT EXISTS", so this throws "duplicate column" on an
  // already-migrated DB — which the per-statement guard below swallows.
  `ALTER TABLE "Entry" ADD COLUMN "embedding" TEXT`,
];

let done: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  // Memoize so concurrent callers share one run per server instance.
  if (!done) {
    done = (async () => {
      for (const sql of STATEMENTS) {
        // Per-statement guard: every statement is idempotent, but some (like
        // ALTER ADD COLUMN on an already-migrated DB) intentionally throw a
        // harmless "duplicate column" — swallow it and keep going.
        try {
          await prisma.$executeRawUnsafe(sql);
        } catch (err) {
          const msg = String((err as Error)?.message ?? "");
          if (/duplicate column|already exists/i.test(msg)) continue;
          console.error("ensureSchema statement failed", msg);
        }
      }
    })();
  }
  return done;
}
