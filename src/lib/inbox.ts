import { logAction } from "@/lib/capabilities";
import { createCommitment, parseDueDate } from "@/lib/commitments";
import { triageEmails } from "@/lib/companion";
import { buildEntryInput, createEntry } from "@/lib/entries";
import { addProposals, fetchRecentMessages, gmailConnected, markSeen, parseAddress, type Proposal } from "@/lib/gmail";

export interface InboxScanResult {
  scanned: number;
  created: { id: string; title: string }[];
  proposed: number;
  replies: number;
  renewals: number;
  spends: number;
  message: string;
}

// The shared inbox triage: action items → commitments, reply-worthy mail → draft
// replies, renewals → alerts. Used by the manual "Scan inbox now" and by autonomy.
export async function runInboxScan(tz = 0): Promise<InboxScanResult> {
  const empty: InboxScanResult = { scanned: 0, created: [], proposed: 0, replies: 0, renewals: 0, spends: 0, message: "No new mail to scan." };
  if (!(await gmailConnected())) return { ...empty, message: "Gmail not connected." };

  const messages = await fetchRecentMessages({ days: 7, max: 15 });
  if (messages.length === 0) return empty;

  const byId = new Map(messages.map((m) => [m.id, m]));
  const triaged = await triageEmails(messages);
  const now = new Date();
  const created: { id: string; title: string }[] = [];
  const proposals: Proposal[] = [];
  let spends = 0;

  for (const t of triaged) {
    const msg = byId.get(t.messageId);
    if (!msg) continue;

    if (t.kind === "spend" && t.amount > 0) {
      const input = buildEntryInput("expense", {
        type: "expense",
        title: t.title || "Payment",
        summary: t.summary || msg.subject,
        details: `From email: ${msg.subject}`,
        amount: String(t.amount),
        category: t.category || "Other",
        recurring: "one-time",
      });
      if (input?.title) {
        const e = await createEntry(input);
        spends++;
        await logAction({ capability: "gmail.capture", summary: `From email → expense: ${input.title} (${t.amount})`, reason: "A transaction/payment notification — logged so your spending stays current without manual entry.", source: "gmail", entityId: e.id });
      }
    } else if (t.kind === "commitment" && t.title) {
      const dueDate = t.due ? parseDueDate(t.due, now, tz) : null;
      const c = await createCommitment({ title: t.title, description: t.summary || null, dueDate, sourceType: "gmail", sourceId: t.messageId });
      created.push({ id: c.id, title: c.title });
      await logAction({ capability: "gmail.capture", summary: `From email → commitment: ${c.title}`, reason: "A recent email contained a concrete action item.", source: "gmail", entityId: c.id });
    } else if (t.kind === "reply" && t.draft) {
      proposals.push({
        id: t.messageId,
        kind: "reply",
        from: msg.from,
        to: parseAddress(msg.from),
        subject: msg.subject.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject}`,
        body: t.draft,
        summary: t.summary || msg.subject,
        createdAt: Date.now(),
      });
    } else if (t.kind === "renewal") {
      proposals.push({ id: t.messageId, kind: "renewal", from: msg.from, summary: t.summary || msg.subject, createdAt: Date.now() });
    }
  }

  await addProposals(proposals);
  await markSeen(messages.map((m) => m.id));

  const replies = proposals.filter((p) => p.kind === "reply").length;
  const renewals = proposals.filter((p) => p.kind === "renewal").length;
  const parts: string[] = [];
  if (created.length) parts.push(`${created.length} action ${created.length === 1 ? "item" : "items"}`);
  if (spends) parts.push(`${spends} expense${spends === 1 ? "" : "s"}`);
  if (replies) parts.push(`${replies} reply ${replies === 1 ? "draft" : "drafts"}`);
  if (renewals) parts.push(`${renewals} renewal ${renewals === 1 ? "alert" : "alerts"}`);

  return {
    scanned: messages.length,
    created,
    proposed: proposals.length,
    replies,
    renewals,
    spends,
    message: parts.length ? `Found ${parts.join(", ")} in ${messages.length} emails.` : `Scanned ${messages.length} emails — nothing needed action.`,
  };
}
