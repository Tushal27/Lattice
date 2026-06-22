import { activitySnapshot, githubConnected, snapshotToText } from "@/lib/github";
import { ingestText } from "@/lib/ingest";

// Pull recent engineering activity and distill it into a knowledge entry.
// Deduped per day so repeated syncs don't pile up.
export async function POST() {
  if (!(await githubConnected())) {
    return Response.json({ error: "GitHub not connected." }, { status: 401 });
  }

  const snapshot = await activitySnapshot();
  if (!snapshot || snapshot.repos.length === 0) {
    return Response.json({ ok: true, message: "No recent GitHub activity found." });
  }

  const day = new Date().toISOString().slice(0, 10);
  const result = await ingestText({
    provider: "github",
    title: `Engineering activity — ${day}`,
    text: snapshotToText(snapshot),
    externalId: `github:${snapshot.login}:${day}`,
    typeHint: "snippet",
  });

  return Response.json({
    ...result,
    message: result.skipped
      ? "Already captured today's activity."
      : result.ok
        ? `Captured engineering activity across ${snapshot.repos.length} repos.`
        : "Couldn't capture activity.",
  });
}
