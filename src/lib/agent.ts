// The Lattice agent — turns a natural-language message into actions on the
// user's second brain (create / update / connect / search), then replies.
//
// It uses a strict-JSON tool protocol rather than vendor function-calling, so it
// behaves identically across every provider in the fallback engine (and a future
// self-hosted model). A bounded loop lets it look things up before acting, but
// it can't run away or delete anything.

import { aiEnabled, generateDetailed } from "@/lib/ai";
import { jsonrepair } from "jsonrepair";
import {
  addConnection,
  buildEntryInput,
  createEntry,
  entryToFormValues,
  getEntry,
  listEntries,
  listProjects,
  searchEntries,
  updateEntry,
} from "@/lib/entries";
import { TYPE_LIST, TYPES, isEntryType } from "@/lib/types";
import { parseFields } from "@/lib/utils";

const MAX_STEPS = 4;

export interface ExecutedStep {
  tool: string;
  ok: boolean;
  summary: string;
  entryId?: string;
  entryType?: string;
  entryTitle?: string;
}

export interface AgentResult {
  reply: string;
  steps: ExecutedStep[];
  source: "ai" | "local";
  provider?: string;
  /** True if any write happened, so the UI can refresh data. */
  mutated: boolean;
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

const WRITE_TOOLS = new Set(["create_entry", "update_entry", "connect_entries"]);

export async function runAgent(
  message: string,
  history: AgentTurn[] = [],
  opts: { preserveRaw?: boolean } = {},
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

  for (let i = 0; i < MAX_STEPS; i++) {
    const prompt = buildPrompt(context, history, message, steps, readResults);
    const res = await generateDetailed(prompt, { system: AGENT_SYSTEM, temperature: 0.3 });
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
      const step = await execute(action, { preserveRaw: opts.preserveRaw, rawText: message });
      steps.push(step);
      if (step.ok && WRITE_TOOLS.has(action.tool)) {
        didWrite = true;
        if (action.tool === "create_entry" && step.entryTitle) createdTitles.add(step.entryTitle.toLowerCase());
      }
      if (step.ok && !WRITE_TOOLS.has(action.tool) && step.summary) {
        readResults.push(step.summary);
      }
    }

    if (parsed.reply) reply = parsed.reply;
    // Once anything has been written, stop — prevents duplicate creates and
    // retry loops on a failed connect.
    if (didWrite || parsed.done || parsed.actions.length === 0) break;
  }

  return {
    reply: reply || "Done.",
    steps,
    source: "ai",
    provider,
    mutated: steps.some((s) => s.ok && WRITE_TOOLS.has(s.tool)),
  };
}

// ---- tool execution --------------------------------------------------------

interface ExecOpts {
  preserveRaw?: boolean;
  rawText?: string;
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
  const [recent, projects] = await Promise.all([listEntries({ limit: 20 }), listProjects()]);
  const recentText = recent.map((e) => `${e.id} · ${e.type} · ${e.title}`).join("\n");
  const projectText = projects.map((p) => `${p.id} · ${p.title}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  return { recentText, projectText, today };
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
  ctx: { recentText: string; projectText: string; today: string },
  history: AgentTurn[],
  message: string,
  steps: ExecutedStep[],
  readResults: string[],
): string {
  const parts: string[] = [];
  parts.push(`Today is ${ctx.today}.`);
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
  "- search_entries{query} — find entries (use before update/connect to get real ids).",
  "- get_entry{id} — read one entry's full details.",
  "- list_projects{} / list_recent{limit?} — browse.",
  "",
  "Entry types and their fields (put type-specific fields inside `fields`):",
  typeSchema(),
  "",
  "Rules:",
  "- PRESERVE MEANING, don't crush it. Write a strong, specific title and a one-line summary, and fill the structured fields with the real specifics (lists, names, numbers).",
  "- You do NOT need to copy the user's entire message verbatim — the system automatically keeps their full original text in `details`. Focus on a great title, summary, type, and tags. For very long pastes, keep your JSON compact.",
  "- For a big dump (work log, brain dump), prefer creating ONE rich entry that keeps it all rather than several thin ones, unless the user clearly lists separate items.",
  "- Fill EVERY relevant field. Be generous and specific: a real title, a one-line summary, context/reasoning, 2-4 lowercase tags. Leave a field empty only if the user truly gave nothing for it (do not write 'none').",
  "- For decisions, estimate a confidence (0-100) from how sure they sound. Do NOT set review-only fields when first creating a decision.",
  "- REVIEWING A DECISION: when the user grades how a past decision turned out (e.g. \"review my X decision\", \"that call worked out\", \"it was the wrong move\"), first search_entries to find its id, then update_entry with the review-only fields: reviewOutcome (what actually happened), reviewVerdict (Right call|Mixed|Wrong call|Too early to tell), wouldRepeat (Yes|No|Not sure), reviewLearning. Don't change the original decision text.",
  "- When the user is simply capturing a thought, create ONE entry and STOP — do not connect, search, or create extras. Set done=true.",
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
