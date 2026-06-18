import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// One adapter for every environment. libSQL speaks SQLite, so the same code
// path serves a local file in development and a hosted Turso database in
// production — just by swapping environment variables:
//
//   Local:  DATABASE_URL=file:./dev.db
//   Turso:  TURSO_DATABASE_URL=libsql://<db>.turso.io  +  TURSO_AUTH_TOKEN=...
const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrisma() {
  const adapter = new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot-reloads in dev to avoid exhausting handles.
export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
