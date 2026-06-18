// Applies Prisma's migration SQL to a hosted Turso database.
// Usage:
//   TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=... npm run db:turso
//
// Runs every prisma/migrations/<timestamp>/migration.sql in order. SQLite/libSQL
// statements are idempotent enough for a fresh database; re-running on an
// existing one will error on "already exists", which is safe to ignore.

import { createClient } from "@libsql/client";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.");
  process.exit(1);
}

const dir = join(process.cwd(), "prisma", "migrations");
if (!existsSync(dir)) {
  console.error("No prisma/migrations directory found.");
  process.exit(1);
}

const migrations = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const client = createClient({ url, ...(authToken ? { authToken } : {}) });

for (const name of migrations) {
  const file = join(dir, name, "migration.sql");
  if (!existsSync(file)) continue;
  const sql = readFileSync(file, "utf8");
  process.stdout.write(`Applying ${name}… `);
  try {
    await client.executeMultiple(sql);
    console.log("ok");
  } catch (err) {
    console.log(`skipped (${err.message.split("\n")[0]})`);
  }
}

console.log("Turso schema is up to date.");
process.exit(0);
