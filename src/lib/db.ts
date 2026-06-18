import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// The Prisma 7 driver-adapter model: the connection URL is passed to the
// adapter rather than living in the schema. We fall back to a sensible default
// so the app runs on a fresh clone even before a local `.env` exists.
const url = process.env.DATABASE_URL ?? "file:./dev.db";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrisma() {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot-reloads in dev to avoid exhausting handles.
export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
