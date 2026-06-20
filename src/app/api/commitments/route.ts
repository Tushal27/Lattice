import {
  commitmentCounts,
  createCommitment,
  groupedCommitments,
  parseDueDate,
  parseRecurrence,
  seedRecurringDue,
} from "@/lib/commitments";

export async function GET() {
  const [groups, counts] = await Promise.all([groupedCommitments(), commitmentCounts()]);
  return Response.json({ ...groups, counts });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "A title is required" }, { status: 400 });

  // `due` may be a natural-language phrase ("tomorrow at 9") or an ISO date.
  const dueRaw = body.due ?? body.dueDate;
  const dueText = typeof dueRaw === "string" ? dueRaw : "";
  let dueDate =
    dueRaw instanceof Date ? dueRaw : typeof dueRaw === "string" ? parseDueDate(dueRaw) : null;
  const recurringRule =
    (typeof body.recurringRule === "string" && body.recurringRule) ||
    parseRecurrence(dueText) ||
    parseRecurrence(title) ||
    null;
  // A recurring commitment with no explicit day gets a sensible first slot.
  if (recurringRule && !dueDate) dueDate = seedRecurringDue(recurringRule, `${dueText} ${title}`);

  const commitment = await createCommitment({
    title,
    description: typeof body.description === "string" ? body.description : null,
    dueDate,
    recurringRule,
    priority: typeof body.priority === "string" ? body.priority : null,
    sourceType: typeof body.sourceType === "string" ? body.sourceType : "manual",
    sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
  });
  return Response.json(commitment, { status: 201 });
}
