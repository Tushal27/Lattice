import { logAction } from "@/lib/capabilities";
import { extractFromEmails } from "@/lib/companion";
import { createCommitment, parseDueDate } from "@/lib/commitments";
import { fetchRecentMessages, gmailConnected, gmailEnabled, markSeen } from "@/lib/gmail";

// Read recent inbox mail, extract genuine action items via AI, and turn them
// into commitments (sourced from Gmail, so they're cancellable like any other).
// Idempotent: processed message ids are remembered, so re-syncing won't dupe.
export async function POST(request: Request) {
  if (!gmailEnabled()) {
    return Response.json({ error: "Gmail not configured." }, { status: 503 });
  }
  if (!(await gmailConnected())) {
    return Response.json({ error: "Gmail not connected." }, { status: 401 });
  }

  const tz = await request
    .json()
    .then((b: { tz?: number }) => (typeof b?.tz === "number" ? b.tz : 0))
    .catch(() => 0);

  const messages = await fetchRecentMessages({ days: 7, max: 15 });
  if (messages.length === 0) {
    return Response.json({ scanned: 0, created: [], message: "No new mail to scan." });
  }

  const extractions = await extractFromEmails(messages);
  const now = new Date();
  const created: { id: string; title: string; due: string | null }[] = [];

  for (const ex of extractions) {
    if (ex.kind !== "commitment" || !ex.title) continue;
    const dueDate = ex.due ? parseDueDate(ex.due, now, tz) : null;
    const c = await createCommitment({
      title: ex.title,
      description: ex.summary || null,
      dueDate,
      sourceType: "gmail",
      sourceId: ex.messageId,
    });
    created.push({ id: c.id, title: c.title, due: dueDate ? dueDate.toISOString() : null });
    await logAction({ capability: "gmail.capture", summary: `From email → commitment: ${c.title}`, source: "gmail", entityId: c.id });
  }

  // Remember every message we looked at, action item or not, so we don't re-scan.
  await markSeen(messages.map((m) => m.id));

  return Response.json({
    scanned: messages.length,
    created,
    message: created.length
      ? `Found ${created.length} action ${created.length === 1 ? "item" : "items"} in ${messages.length} recent emails.`
      : `Scanned ${messages.length} emails — nothing that needed a commitment.`,
  });
}
