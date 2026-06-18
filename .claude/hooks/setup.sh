#!/usr/bin/env bash
# Prepares Lattice for a fresh session: installs deps, generates the Prisma
# client, and applies migrations so the app can build, lint, and run.
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies…"
  npm install
fi

# The generated Prisma client is gitignored, so (re)generate it.
npx prisma generate >/dev/null 2>&1 || true

# Ensure the local SQLite database exists and is migrated.
npx prisma migrate deploy >/dev/null 2>&1 || true

echo "Lattice ready."
