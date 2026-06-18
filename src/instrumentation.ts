// Runs once when a Next.js server instance starts. We use it to make sure the
// database schema exists before any request is served, so a freshly created
// (empty) production database — like a new Turso instance — just works without
// a manual migration step.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureSchema } = await import("@/lib/ensureSchema");
  await ensureSchema();
}
