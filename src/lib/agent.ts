// The Lattice agent — turns a natural-language message into actions on the
// user's second brain (create / update / connect / search), then replies.
//
// It uses a strict-JSON tool protocol rather than vendor function-calling, so it
// behaves identically across every provider in the fallback engine (and a future
// self-hosted model). A bounded loop lets it look things up before acting, but
// it can't run away or delete anything.

import { aiEnabled, generateDetailed } from "@/lib/ai";
import { calendarConnected, createEvent, deleteEvent, findFreeSlots, updateEvent, upcomingEvents } from "@/lib/calendar";
import { getTrust, logAction } from "@/lib/capabilities";
import { contactHasEmail, resolveContactEmail } from "@/lib/contacts";
import { jsonrepair } from "jsonrepair";
import { createCommitment, parseDueDate, parseRecurrence, seedRecurringDue } from "@/lib/commitments";
import { classifyThought } from "@/lib/companion";
import {
  addConnection,
  autoLinkByTags,
  buildEntryInput,
  createEntry,
  entryToFormValues,
  getEntry,
  listEntries,
  listProjects,
  searchEntries,
  updateEntry,
} from "@/lib/entries";
import { factsBlock } from "@/lib/memory";
import { MODULES, TYPE_LIST, TYPES, isEntryType } from "@/lib/types";
import { parseFields } from "@/lib/utils";

const MAX_STEPS = 4;

export interface ExecutedStep {
  tool: string;
  ok: boolean;
  summary: string;
  entryId?: string;
  entryType?: string;
  entryTitle?: string;
  draft?: EmailDraft;
}

export interface SuggestedCommitment {
  title: string;
  due: string;
  sourceType: string;
  sourceId: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface AgentResult {
  reply: string;
  steps: ExecutedStep[];
  source: "ai" | "local";
  provider?: string;
  /** True if any write happened, so the UI can refresh data. */
  mutated: boolean;
  /** A follow-through the user can confirm (not auto-saved). */
  suggestion?: SuggestedCommitment;
  /** A composed email for the user to review and send (never auto-sent). */
  emailDraft?: EmailDraft;
}

export interface AgentTurn {
  role: "you" | "ai";
  text: string;
}

interface ParsedAgent {
  actions: { tool: string; args: Record<string, unknown> }[];
  reply?: string;
  done?: boolean;
}

const WRITE_TOOLS = new Set(["create_entry", "update_entry", "connect_entries", "create_commitment"]);
// Tools that count as "the assistant did something for you". Includes calendar
// events — which aren't local writes but ARE real actions, so the capture
// safety-net must not treat a successful calendar event as "nothing happened".
const ACTION_TOOLS = new Set([...WRITE_TOOLS, "create_calendar_event", "send_email", "reschedule_event", "cancel_event"]);

export async function runAgent(
  message: string,
  history: AgentTurn[] = [],
  opts: { preserveRaw?: boolean; images?: string[]; tz?: number; memory?: string } = {},
): Promise<AgentResult> {
  if (!aiEnabled()) {
    return {
      reply:
        "The agent needs an AI key to act for you — add GROQ_API_KEY (recommended), or another provider, and I'll start filling things in from your words.",
      steps: [],
      source: "local",
      mutated: false,
    };
  }

  const context = await buildContext();
  const steps: ExecutedStep[] = [];
  const readResults: string[] = [];
  const createdTitles = new Set<string>();
  let reply = "";
  let provider: string | undefined;
  let forcedCapture = false;

  for (let i = 0; i < MAX_STEPS; i++) {
    const prompt = buildPrompt(context, history, message, steps, readResults, opts.memory ?? "");
    // Send any attached images only on the first step (the model reads them to
    // decide what to capture); later reasoning steps don't need to resend them.
    const res = await generateDetailed(prompt, {
      system: AGENT_SYSTEM,
      temperature: 0.3,
      images: i === 0 ? opts.images : undefined,
    });
    if (!res) {
      reply = reply || "I couldn't reach the AI engine just now — please try again.";
      break;
    }
    provider = res.provider;

    const parsed = parseAgent(res.text);
    if (!parsed) {
      // If it looks like broken protocol JSON, never show that raw to the user.
      reply = looksLikeProtocol(res.text)
        ? "I had trouble completing that cleanly — could you try rephrasing or sending again?"
        : res.text.trim();
      break;
    }

    let didWrite = false;
    for (const action of parsed.actions) {
      if (steps.length >= 12) break;
      // Guard against the model re-creating the same entry in a runaway loop.
      if (action.tool === "create_entry") {
        const t = String(action.args?.title ?? "").trim().toLowerCase();
        if (t && createdTitles.has(t)) continue;
      }
      const step = await execute(action, { preserveRaw: opts.preserveRaw, rawText: message, tz: opts.tz });
      steps.push(step);
      if (step.ok && ACTION_TOOLS.has(action.tool)) {
        didWrite = true;
        if (action.tool === "create_entry" && step.entryTitle) createdTitles.add(step.entryTitle.toLowerCase());
      }
      if (step.ok && !ACTION_TOOLS.has(action.tool) && step.summary) {
        readResults.push(step.summary);
      }
    }

    if (parsed.reply) reply = parsed.reply;
    // Once anything has been written, stop — prevents duplicate creates and
    // retry loops on a failed connect.
    if (didWrite || parsed.done || parsed.actions.length === 0) {
      // Capture-intent guard: models sometimes reply "Captured…" while emitting
      // no create action, so nothing is actually saved. Force one corrective
      // step before giving up.
      const wroteAnything = steps.some((s) => s.ok && ACTION_TOOLS.has(s.tool));
      if (opts.preserveRaw && !wroteAnything && !forcedCapture && claimsCapture(reply)) {
        forcedCapture = true;
        readResults.push(
          "CRITICAL: You replied as if you saved something, but you emitted NO create action, so nothing was saved. The user's message is something to capture. Emit a create_entry now (or create_commitment if it's a reminder/task) with the best-fit type and full detail. Never claim to have captured/saved anything without the matching action in the same response.",
        );
        continue;
      }
      break;
    }
  }

  // Final safety net: on a direct capture, if the model claimed it saved
  // something but still emitted no write, create the entry ourselves so the
  // user's input is never silently lost. Classification falls back to a local
  // heuristic when the AI is unavailable.
  if (opts.preserveRaw && claimsCapture(reply) && !steps.some((s) => s.ok && ACTION_TOOLS.has(s.tool))) {
    try {
      const c = await classifyThought(message);
      const type = isEntryType(c.type) ? c.type : "lesson";
      const input = buildEntryInput(type, {
        type,
        title: c.title,
        summary: c.summary,
        tags: c.tags,
        details: message,
      });
      if (input?.title) {
        const entry = await createEntry(input);
        steps.push({
          tool: "create_entry",
          ok: true,
          summary: `Created ${TYPES[type].label}: ${input.title}`,
          entryId: entry.id,
          entryType: type,
          entryTitle: input.title,
        });
        if (!reply.trim()) reply = `Captured your ${TYPES[type].label.toLowerCase()} — “${input.title}”.`;
      }
    } catch (err) {
      console.error("capture safety-net failed", err);
    }
  }

  // Auto-connect freshly created entries to related ones (the graph builds
  // itself). Conservative: only on real tag overlap.
  const created = steps.filter((s) => s.tool === "create_entry" && s.ok && s.entryId);
  for (const c of created) {
    const linked = await autoLinkByTags(c.entryId!, 2);
    for (const e of linked) {
      steps.push({ tool: "connect_entries", ok: true, summary: `Auto-linked to “${e.title}”` });
    }
  }

  // Offer (don't impose) a follow-through when a decision or question was just
  // captured and the user didn't already set a commitment this turn.
  let suggestion: SuggestedCommitment | undefined;
  const madeCommitment = steps.some((s) => s.tool === "create_commitment" && s.ok);
  const SUGGESTABLE = new Set(["decision", "financial-decision", "question", "investment"]);
  const actionable = steps.find(
    (s) => s.tool === "create_entry" && s.ok && s.entryId && s.entryType && SUGGESTABLE.has(s.entryType),
  );
  if (actionable && !madeCommitment) {
    const t = actionable.entryType;
    if (t === "question") {
      suggestion = { title: `Research: ${actionable.entryTitle}`, due: "in 7 days", sourceType: "question", sourceId: actionable.entryId! };
    } else if (t === "investment") {
      suggestion = { title: `Review thesis: ${actionable.entryTitle}`, due: "in 1 year", sourceType: "investment", sourceId: actionable.entryId! };
    } else {
      suggestion = { title: `Review decision: ${actionable.entryTitle}`, due: "in 14 days", sourceType: t!, sourceId: actionable.entryId! };
    }
  }

  // Audit every successful write so the user has a complete record of what the
  // assistant did on their behalf.
  for (const s of steps) {
    if (s.ok && WRITE_TOOLS.has(s.tool)) {
      await logAction({ capability: s.tool, summary: s.summary, source: "agent", entityId: s.entryId ?? null });
    }
  }

  const emailDraft = steps.find((s) => s.tool === "send_email" && s.ok && s.draft)?.draft;

  return {
    reply: reply || "Done.",
    steps,
    source: "ai",
    provider,
    mutated: steps.some((s) => s.ok && WRITE_TOOLS.has(s.tool)),
    suggestion,
    emailDraft,
  };
}

// ---- tool execution --------------------------------------------------------

interface ExecOpts {
  preserveRaw?: boolean;
  rawText?: string;
  tz?: number;
}

async function execute(
  action: { tool: string; args: Record<string, unknown> },
  opts: ExecOpts = {},
): Promise<ExecutedStep> {
  const a = action.args ?? {};
  try {
    switch (action.tool) {
      case "create_entry":
        return await createTool(a, opts);
      case "update_entry":
        return await updateTool(a);
      case "connect_entries":
        return await connectTool(a);
      case "create_commitment":
        return await commitmentTool(a, opts);
      case "create_calendar_event":
        return await calendarTool(a, opts);
      case "send_email":
        return await emailTool(a, opts);
      case "list_events":
        return await listEventsTool(a);
      case "find_free_time":
        return await freeTimeTool(a, opts);
      case "reschedule_event":
        return await rescheduleTool(a, opts);
      case "cancel_event":
        return await cancelEventTool(a);
      case "search_entries":
        return await searchTool(a);
      case "get_entry":
        return await getTool(a);
      case "list_projects":
        return await projectsTool();
      case "list_recent":
        return await recentTool(a);
      default:
        return { tool: action.tool, ok: false, summary: `Unknown tool: ${action.tool}` };
    }
  } catch (err) {
    return { tool: action.tool, ok: false, summary: `Failed: ${(err as Error).message}` };
  }
}

function flatten(args: Record<string, unknown>): Record<string, unknown> {
  const fields = (args.fields && typeof args.fields === "object" ? args.fields : {}) as Record<string, unknown>;
  const { fields: _omit, ...top } = args;
  void _omit;
  return { ...fields, ...top };
}

async function createTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  const type = String(args.type ?? "");
  if (!isEntryType(type)) return { tool: "create_entry", ok: false, summary: `Unknown type "${type}"` };
  const flat = flatten(args);
  // For a direct capture, guarantee the user's full text survives even if the
  // model abbreviated it — keep everything in `details`.
  if (opts.preserveRaw && opts.rawText) {
    const modelDetails = String(flat.details ?? "");
    if (modelDetails.length < opts.rawText.length * 0.8) flat.details = opts.rawText;
  }
  const input = buildEntryInput(type, flat);
  if (!input || !input.title) return { tool: "create_entry", ok: false, summary: "A title is required" };
  const entry = await createEntry(input);
  const label = TYPES[type].label;
  return {
    tool: "create_entry",
    ok: true,
    summary: `Created ${label}: ${input.title}`,
    entryId: entry.id,
    entryType: type,
    entryTitle: input.title,
  };
}

async function updateTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const id = String(args.id ?? "");
  const entry = await getEntry(id);
  if (!entry || !isEntryType(entry.type)) return { tool: "update_entry", ok: false, summary: "Entry not found" };

  const current = entryToFormValues(entry, entry.type);
  const incoming = flatten(args);
  delete incoming.id;
  delete incoming.type;
  const merged: Record<string, unknown> = { ...current, ...incoming, type: entry.type };
  merged.tags = Array.isArray(args.tags)
    ? (args.tags as string[])
    : entry.tags.map((t) => t.tag.name);
  merged.projectId = args.projectId ?? entry.projectId;

  const input = buildEntryInput(entry.type, merged);
  if (!input || !input.title) return { tool: "update_entry", ok: false, summary: "Update needs a title" };
  await updateEntry(id, input);
  return {
    tool: "update_entry",
    ok: true,
    summary: `Updated: ${input.title}`,
    entryId: id,
    entryType: entry.type,
    entryTitle: input.title,
  };
}

async function connectTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const fromId = String(args.fromId ?? "");
  const toId = String(args.toId ?? "");
  if (!fromId || !toId) return { tool: "connect_entries", ok: false, summary: "Need two entries to link" };
  if (fromId === toId) return { tool: "connect_entries", ok: false, summary: "Can't link an entry to itself" };
  // Validate both exist so a bad/invented id returns a clean message instead of
  // a raw foreign-key error.
  const [a, b] = await Promise.all([getEntry(fromId), getEntry(toId)]);
  if (!a || !b) return { tool: "connect_entries", ok: false, summary: "Couldn't link — entry not found" };
  await addConnection(fromId, toId, args.note ? String(args.note) : null);
  return { tool: "connect_entries", ok: true, summary: `Linked “${a.title}” ↔ “${b.title}”` };
}

async function commitmentTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  const tz = opts.tz ?? 0;
  const title = String(args.title ?? "").trim();
  if (!title) return { tool: "create_commitment", ok: false, summary: "A commitment needs a title" };
  const dueRaw = args.due != null ? String(args.due) : null;
  let dueDate = parseDueDate(dueRaw, new Date(), tz);
  const recurringRule =
    (args.recurring != null && String(args.recurring)) ||
    parseRecurrence(dueRaw) ||
    parseRecurrence(title) ||
    null;
  if (recurringRule && !dueDate) dueDate = seedRecurringDue(recurringRule, `${dueRaw ?? ""} ${title}`, new Date(), tz);
  const c = await createCommitment({
    title,
    description: args.note != null ? String(args.note) : null,
    dueDate,
    recurringRule: recurringRule || null,
    priority: args.priority != null ? String(args.priority) : null,
    sourceType: args.sourceType != null ? String(args.sourceType) : "agent",
    sourceId: args.sourceId != null ? String(args.sourceId) : null,
  });
  const when = dueDate
    ? ` · due ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  void c;
  return {
    tool: "create_commitment",
    ok: true,
    summary: `Set a commitment: ${title}${when}`,
    entryTitle: title,
  };
}

// Outward action: put an event on Google Calendar. Respects the user's trust
// dial — off refuses, ask proposes (without acting), auto acts then reports.
// Every outcome is written to the audit log.
async function calendarTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  const tz = opts.tz ?? 0;
  const title = String(args.summary ?? args.title ?? "").trim();
  if (!title) return { tool: "create_calendar_event", ok: false, summary: "An event needs a title" };

  const whenRaw = args.start != null ? String(args.start) : args.when != null ? String(args.when) : args.due != null ? String(args.due) : null;
  const start = parseDueDate(whenRaw, new Date(), tz);
  if (!start) return { tool: "create_calendar_event", ok: false, summary: "I need a date/time for the event" };

  const trust = await getTrust("calendar.create_event");
  if (trust === "off") {
    return { tool: "create_calendar_event", ok: false, summary: "Calendar events are turned off in Settings." };
  }
  if (!(await calendarConnected())) {
    return { tool: "create_calendar_event", ok: false, summary: "Connect Google in Settings to use your calendar." };
  }

  const whenLabel = start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (trust === "ask") {
    // Suggest + confirm: don't act, record the proposal, and tell the user how
    // to let it act automatically.
    await logAction({ capability: "calendar.create_event", summary: `Proposed event: ${title} · ${whenLabel}`, source: "agent", status: "proposed" });
    return {
      tool: "create_calendar_event",
      ok: true,
      summary: `Proposed “${title}” for ${whenLabel} (set Calendar to Auto in Settings to let me add it directly)`,
    };
  }

  // auto: act, then report.
  const durationMin = Number(args.durationMinutes) || 30;
  const created = await createEvent({
    summary: title,
    description: args.note != null ? String(args.note) : undefined,
    start,
    end: new Date(start.getTime() + durationMin * 60000),
    location: args.location != null ? String(args.location) : undefined,
  });
  if (!created) {
    await logAction({ capability: "calendar.create_event", summary: `Failed to add event: ${title}`, source: "agent", status: "failed" });
    return { tool: "create_calendar_event", ok: false, summary: "Couldn't reach Google Calendar just now." };
  }
  await logAction({ capability: "calendar.create_event", summary: `Added to calendar: ${title} · ${whenLabel}`, reason: "You asked me to schedule this, and calendar access is set to Auto.", source: "agent", entityId: created.id });
  return { tool: "create_calendar_event", ok: true, summary: `Added to your calendar: ${title} · ${whenLabel}` };
}

// Outward action: compose an email. It NEVER sends here — it returns a draft the
// user reviews and sends from the chat. Gated by the gmail.send_email capability.
async function emailTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  if ((await getTrust("gmail.send_email")) === "off") {
    return { tool: "send_email", ok: false, summary: "Sending email is turned off in Settings." };
  }
  let to = String(args.to ?? args.recipient ?? "").trim();
  // Did the user actually type an email? If not, never trust an address the model
  // produced — it tends to FABRICATE one (e.g. "santhosh zakapps" → santhosh@
  // zakapps.com). Resolve names from real Contacts only.
  const userGaveEmail = /\S+@\S+\.\S+/.test(opts.rawText ?? "");
  if (to.includes("@")) {
    if (!userGaveEmail && !(await contactHasEmail(to).catch(() => false))) {
      // Fabricated address — recover the likely name and resolve it properly.
      const namePart = to.split("@")[0].replace(/[._-]+/g, " ").trim();
      to = (await resolveContactEmail(namePart).catch(() => null)) ?? namePart;
    }
  } else if (to) {
    const resolved = await resolveContactEmail(to).catch(() => null);
    if (resolved) to = resolved;
  }

  const subject = String(args.subject ?? "").trim();
  const body = String(args.body ?? args.message ?? "").trim();
  if (!body) return { tool: "send_email", ok: false, summary: "I need the message to draft an email." };

  const resolved = to.includes("@");
  return {
    tool: "send_email",
    ok: true,
    summary: resolved ? `Drafted an email to ${to}` : to ? `Drafted an email — add ${to}'s address` : "Drafted an email — add the recipient",
    draft: { to, subject, body },
  };
}

async function listEventsTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  if (!(await calendarConnected())) return { tool: "list_events", ok: false, summary: "Connect Google in Settings to use your calendar." };
  const days = Math.min(Number(args.days) || 7, 30);
  const events = await upcomingEvents({ days, max: 25 });
  const list = events
    .map((e) => `${e.id} · ${new Date(e.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${e.summary}`)
    .join("\n");
  return { tool: "list_events", ok: true, summary: `upcoming events (id · when · title):\n${list || "(none)"}` };
}

async function freeTimeTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  if (!(await calendarConnected())) return { tool: "find_free_time", ok: false, summary: "Connect Google in Settings to use your calendar." };
  const durationMin = Number(args.durationMinutes) || 30;
  const withinDays = Number(args.withinDays) || 5;
  const slots = await findFreeSlots({ durationMin, withinDays, tz: opts.tz ?? 0 });
  if (slots.length === 0) return { tool: "find_free_time", ok: true, summary: `No open ${durationMin}-min slots found in the next ${withinDays} days during working hours.` };
  const list = slots
    .map((s) => `${s.start} → ${new Date(s.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`)
    .join("\n");
  return { tool: "find_free_time", ok: true, summary: `Open ${durationMin}-min slots (ISO start · readable):\n${list}` };
}

async function rescheduleTool(args: Record<string, unknown>, opts: ExecOpts = {}): Promise<ExecutedStep> {
  if ((await getTrust("calendar.create_event")) === "off") return { tool: "reschedule_event", ok: false, summary: "Calendar changes are turned off in Settings." };
  if (!(await calendarConnected())) return { tool: "reschedule_event", ok: false, summary: "Connect Google in Settings first." };
  const id = String(args.id ?? "").trim();
  const start = parseDueDate(args.start != null ? String(args.start) : null, new Date(), opts.tz ?? 0);
  if (!id || !start) return { tool: "reschedule_event", ok: false, summary: "I need the event id and a new time." };
  const durationMin = Number(args.durationMinutes) || 30;
  const ok = await updateEvent(id, start, new Date(start.getTime() + durationMin * 60000));
  const when = start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (ok) await logAction({ capability: "calendar.create_event", summary: `Rescheduled an event to ${when}`, reason: "You asked me to move it.", source: "agent", entityId: id });
  return { tool: "reschedule_event", ok, summary: ok ? `Moved the event to ${when}.` : "Couldn't reschedule that event." };
}

async function cancelEventTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  if ((await getTrust("calendar.create_event")) === "off") return { tool: "cancel_event", ok: false, summary: "Calendar changes are turned off in Settings." };
  if (!(await calendarConnected())) return { tool: "cancel_event", ok: false, summary: "Connect Google in Settings first." };
  const id = String(args.id ?? "").trim();
  if (!id) return { tool: "cancel_event", ok: false, summary: "I need the event id to cancel it." };
  const ok = await deleteEvent(id);
  if (ok) await logAction({ capability: "calendar.create_event", summary: "Cancelled a calendar event", reason: "You asked me to cancel it.", source: "agent", entityId: id });
  return { tool: "cancel_event", ok, summary: ok ? "Cancelled the event." : "Couldn't cancel that event." };
}

async function searchTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const query = String(args.query ?? "");
  const results = await searchEntries(query);
  const list = results
    .slice(0, 8)
    .map((e) => `${e.id} · ${e.type} · ${e.title}`)
    .join("\n");
  return {
    tool: "search_entries",
    ok: true,
    summary: `search "${query}" →\n${list || "(no results)"}`,
  };
}

async function getTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const id = String(args.id ?? "");
  const entry = await getEntry(id);
  if (!entry) return { tool: "get_entry", ok: false, summary: "Entry not found" };
  const fields = parseFields(entry.fields);
  return {
    tool: "get_entry",
    ok: true,
    summary: `entry ${id}: ${entry.type} · ${entry.title}\n${JSON.stringify(fields).slice(0, 800)}`,
  };
}

async function projectsTool(): Promise<ExecutedStep> {
  const projects = await listProjects();
  return {
    tool: "list_projects",
    ok: true,
    summary: `projects:\n${projects.map((p) => `${p.id} · ${p.title}`).join("\n") || "(none)"}`,
  };
}

async function recentTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const limit = Math.min(Number(args.limit) || 10, 25);
  const recent = await listEntries({ limit });
  return {
    tool: "list_recent",
    ok: true,
    summary: `recent:\n${recent.map((e) => `${e.id} · ${e.type} · ${e.title}`).join("\n")}`,
  };
}

// ---- prompt construction ---------------------------------------------------

async function buildContext() {
  const [recent, projects, facts] = await Promise.all([
    listEntries({ limit: 60 }),
    listProjects(),
    factsBlock(12),
  ]);
  const recentText = recent.map((e) => `${e.id} · ${e.type} · ${e.title}`).join("\n");
  const projectText = projects.map((p) => `${p.id} · ${p.title}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  return { recentText, projectText, today, facts };
}

function typeSchema(): string {
  return TYPE_LIST.map((cfg) => {
    const fields = cfg.fields
      .map((f) => {
        const tag = f.review ? " [review-only: set via update_entry when grading a past decision]" : "";
        if (f.kind === "select") return `${f.key}(one of: ${(f.options ?? []).filter(Boolean).join("|")})${tag}`;
        if (f.kind === "number") return `${f.key}(number)${tag}`;
        if (f.kind === "date") return `${f.key}(YYYY-MM-DD)${tag}`;
        return `${f.key}${tag}`;
      })
      .join(", ");
    return `- ${cfg.type}: ${fields}`;
  }).join("\n");
}

function buildPrompt(
  ctx: { recentText: string; projectText: string; today: string; facts?: string },
  history: AgentTurn[],
  message: string,
  steps: ExecutedStep[],
  readResults: string[],
  memory = "",
): string {
  const parts: string[] = [];
  parts.push(`Today is ${ctx.today}.`);
  if (ctx.facts) parts.push(`\nDurable facts about the user (long-term memory):\n${ctx.facts}`);
  if (memory) parts.push(`\nMemory from earlier chats (background, may be relevant):\n${memory}`);
  parts.push(`\nRecent entries (id · type · title):\n${ctx.recentText || "(none yet)"}`);
  if (ctx.projectText) parts.push(`\nProjects:\n${ctx.projectText}`);
  if (history.length) {
    parts.push(
      "\nConversation so far:\n" +
        history
          .slice(-6)
          .map((t) => `${t.role === "you" ? "User" : "You"}: ${t.text}`)
          .join("\n"),
    );
  }
  parts.push(`\nUser's new message:\n${message}`);
  if (steps.length) {
    parts.push("\nActions already taken this turn (do NOT repeat them):\n" + steps.map((s) => `- ${s.summary}`).join("\n"));
  }
  if (readResults.length) {
    parts.push("\nLookup results to use (real ids):\n" + readResults.join("\n"));
  }
  parts.push("\nReturn your next step as JSON now.");
  return parts.join("\n");
}

const AGENT_SYSTEM = [
  "You are the agent inside Lattice, a personal operating system (a second brain).",
  "You ACT on the user's behalf by emitting tool calls, then reply warmly and briefly.",
  "",
  "Respond with STRICT JSON only — no markdown, no prose outside JSON — shaped exactly:",
  '{"actions":[{"tool":"<name>","args":{...}}],"reply":"<short message to the user>","done":<true|false>}',
  "",
  "Tools:",
  '- create_entry{type, title, summary?, confidence?(0-100), status?, occurredAt?(YYYY-MM-DD), tags?[], projectId?, fields?{...}} — create a fully-filled entry.',
  "- update_entry{id, ...same fields} — change an existing entry (e.g. mark a question answered, add a decision review).",
  "- connect_entries{fromId, toId, note?} — link two related entries.",
  '- create_commitment{title, due?, recurring?, priority?, note?} — set a follow-through/reminder. `due` is natural language ("tomorrow at 9", "next monday", "in 3 days", "2026-07-01"); `recurring` is daily|weekly|monthly; priority is low|medium|high.',
  '- create_calendar_event{summary, start, durationMinutes?, location?, note?} — put a real event/time-block on the user\'s Google Calendar. `start` is natural language (same as `due`). Use this when the user wants something on their CALENDAR or a scheduled time-block (a meeting, an appointment, "block 2pm tomorrow to…"), as opposed to a plain reminder (use create_commitment for those). The system enforces the user\'s permission for this — just emit it when appropriate.',
  '- list_events{days?} — list upcoming calendar events with their ids (use before rescheduling/cancelling to get the real id).',
  '- find_free_time{durationMinutes?, withinDays?} — find open slots in the user\'s calendar during working hours. Use the returned ISO `start` when you then create_calendar_event for "find me time to…" / "schedule X when I\'m free".',
  '- reschedule_event{id, start, durationMinutes?} — move an event to a new time (get the id from list_events first). `start` is natural language.',
  '- cancel_event{id} — cancel/delete a calendar event (get the id from list_events first).',
  '- send_email{to, subject, body} — compose an email. ALWAYS set `to` to the recipient EXACTLY as the user named them: the plain NAME ("Dr. S jagan", "tharakeshwaran", "Priyanka") when they said a name, or the literal email address only if they typed one. The system resolves names to addresses from the user\'s real Contacts — so never invent or guess an email (do NOT turn "santhosh zakapps" into santhosh@zakapps.com) and never leave `to` empty when the user named someone. Do NOT claim to add anyone to contacts. In the body, never use placeholders like "[Your Name]" — sign off simply (e.g. "Best regards"). This does NOT send — it shows the user a draft to review and send themselves, so always write the FULL, well-composed message (proper greeting and sign-off). Use this whenever the user wants to email/message someone or write/send a mail.',
  "- search_entries{query} — find entries (use before update/connect to get real ids).",
  "- get_entry{id} — read one entry's full details.",
  "- list_projects{} / list_recent{limit?} — browse.",
  "",
  "Entry types and their fields (put type-specific fields inside `fields`):",
  typeSchema(),
  "",
  "Module guidance (pick the most specific fitting type):",
  ...MODULES.filter((m) => m.agentHint).map((m) => `- ${m.name}: ${m.agentHint}`),
  "",
  "Rules:",
  '- MESSY INPUT IS EXPECTED. The user types fast with typos and often dictates by voice, so expect misspellings, swapped homophones (their/there, "flexi cap" mis-heard as "flexi gap", "by" vs "buy"), missing/duplicated words, no punctuation, and fragments run together. Read for INTENT, not literal characters. Silently correct obvious typos and likely speech-to-text errors and write clean, correctly-spelled titles/summaries/fields. NEVER refuse, echo the garbled text back, or ask them to clarify a mere spelling/transcription slip — infer the most sensible meaning and act. (Their full original text is preserved in `details` regardless.) Only ask a question if the actual intent is genuinely ambiguous, not just messy.',
  "- IF AN IMAGE IS ATTACHED: read everything in it (handwriting, whiteboard, screenshot, book page, diagram), transcribe the meaningful content, and capture it as the best-fit entry — keep the real text/details. If the user added a caption, treat it as guidance.",
  "- PRESERVE MEANING, don't crush it. Write a strong, specific title and a one-line summary, and fill the structured fields with the real specifics (lists, names, numbers).",
  "- You do NOT need to copy the user's entire message verbatim — the system automatically keeps their full original text in `details`. Focus on a great title, summary, type, and tags. For very long pastes, keep your JSON compact.",
  "- For a big dump (work log, brain dump), prefer creating ONE rich entry that keeps it all rather than several thin ones, unless the user clearly lists separate items.",
  "- Fill EVERY relevant field. Be generous and specific: a real title, a one-line summary, context/reasoning, 2-4 lowercase tags. Leave a field empty only if the user truly gave nothing for it (do not write 'none').",
  "- For decisions, estimate a confidence (0-100) from how sure they sound. Do NOT set review-only fields when first creating a decision.",
  "- REVIEWING A DECISION: when the user grades how a past decision turned out (e.g. \"review my X decision\", \"that call worked out\", \"it was the wrong move\"), first search_entries to find its id, then update_entry with the review-only fields: reviewOutcome (what actually happened), reviewVerdict (Right call|Mixed|Wrong call|Too early to tell), wouldRepeat (Yes|No|Not sure), reviewLearning. Don't change the original decision text.",
  "- CAPTURE MODE IS FOR SAVING. Any time the user states a thought, insight, decision, lesson, realization, observation, fact, or even a bare question, you MUST emit create_entry — DO NOT just reply. Usually ONE entry; BUT if the user clearly lists several DISTINCT items (labeled sections like 'Goal:' / 'Investments:', or a list of separate things), create ONE entry per item, each with its own best-fit type. A question the user shares is captured as a `question` entry, not answered. Then set done=true. CRITICAL: if your reply claims you captured N things, you must have emitted N matching create actions — never claim more than you created.",
  "- NEVER reply that you captured, saved, filed, noted, created, or recorded something unless you actually emitted the matching create_entry/create_commitment action in the SAME response. No empty 'actions' with a 'Captured…' reply.",
  '- EMAIL: when the user wants to send/write an email or message someone ("email Alice that…", "send a mail to x@y.com saying…", "draft a reply to…"), use send_email and compose the complete message. It is shown for the user to confirm — you never actually send it, so write it as if it\'s going out. Set done=true.',
  '- SMART CALENDAR: for "find me 30 min tomorrow / when am I free" use find_free_time, then create_calendar_event at a returned slot. For "move/reschedule my <event>" or "cancel my <event>", first list_events to get the id, then reschedule_event / cancel_event. To resolve "email <name>", just use the name as `to` — the system looks it up in Contacts.',
  '- CALENDAR: if the user explicitly mentions their CALENDAR, or asks to schedule/book an event, appointment, meeting, or time-block ("put X on my calendar", "set a calendar reminder for …", "schedule …", "book …", "block 2pm for …"), use create_calendar_event — NOT create_entry, and NOT create_commitment. Never capture a scheduling/calendar request as a plain entry. If calendar isn\'t available the tool will say so; in that case fall back to create_commitment so the intent is still saved. Set done=true.',
  '- COMMITMENTS / REMINDERS: when the user wants to do something later, set a reminder, schedule a follow-up, or commit to a habit ("remind me to…", "I need to … by Friday", "every morning I want to…", "follow up on X next week") WITHOUT mentioning their calendar, use create_commitment with the natural-language due date. Don\'t also create an entry for a pure reminder. Set done=true.',
  '- LIST OF TASKS: if the user gives several things to do / a to-do or task list (numbered or bulleted, e.g. "tasks for the next 10 days: 1… 2… 3…"), emit ONE create_commitment per item in the SAME response (spread the due dates across the stated window if implied). Never reply that you "set commitments/reminders" without actually emitting those create_commitment actions.',
  "- Only connect_entries when the user explicitly asks to link things, and only with real ids from the context or a search result. NEVER invent ids or use a title as an id. If you don't have a real id, don't connect.",
  "- Do each write at most once. After your write actions, set done=true and give a short, friendly reply describing what you saved.",
  "- If the user is just chatting or asking about their data, use read tools or none, answer in `reply`, and set done=true.",
  "- Never delete anything. Keep replies under ~3 sentences.",
].join("\n");

function parseAgent(raw: string): ParsedAgent | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = cleaned.slice(start, end + 1);

  let obj: { actions?: unknown; reply?: unknown; done?: unknown } | null = null;
  try {
    obj = JSON.parse(slice);
  } catch {
    // Free models often emit JSON with raw newlines / trailing commas inside
    // strings, which JSON.parse rejects. Repair, then retry.
    try {
      obj = JSON.parse(jsonrepair(slice));
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const actions = Array.isArray(obj.actions)
    ? (obj.actions as unknown[]).filter((x) => x && typeof (x as { tool?: unknown }).tool === "string")
    : [];
  return {
    actions: actions as ParsedAgent["actions"],
    reply: typeof obj.reply === "string" ? obj.reply : undefined,
    done: Boolean(obj.done),
  };
}

/** True if a model reply is (broken) protocol JSON rather than a real message. */
function looksLikeProtocol(raw: string): boolean {
  return /"\s*actions\s*"|"\s*tool\s*"/.test(raw);
}

/** True if the reply asserts it saved/filed/scheduled something — used to catch
 * the case where the model claims success without emitting the matching action
 * (entries OR commitments). */
function claimsCapture(reply: string): boolean {
  if (/\b(captured?|saved|filed|added|noted|logged|recorded|created|stored|scheduled|committed)\b/i.test(reply)) {
    return true;
  }
  // "I've set commitments / a reminder / the tasks…"
  return /\bset\b[\s\S]*\b(reminder|commitment|task)s?\b/i.test(reply);
}
