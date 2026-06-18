// The Lattice agent — turns a natural-language message into actions on the
// user's second brain (create / update / connect / search), then replies.
//
// It uses a strict-JSON tool protocol rather than vendor function-calling, so it
// behaves identically across every provider in the fallback engine (and a future
// self-hosted model). A bounded loop lets it look things up before acting, but
// it can't run away or delete anything.

import { aiEnabled, generateDetailed } from "@/lib/ai";
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

export async function runAgent(message: string, history: AgentTurn[] = []): Promise<AgentResult> {
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
      // Model replied in prose instead of JSON — treat it as the answer.
      reply = res.text.trim();
      break;
    }

    for (const action of parsed.actions) {
      if (steps.length >= 12) break;
      const step = await execute(action);
      steps.push(step);
      if (step.ok && !WRITE_TOOLS.has(action.tool) && step.summary) {
        readResults.push(step.summary);
      }
    }

    if (parsed.reply) reply = parsed.reply;
    if (parsed.done || parsed.actions.length === 0) break;
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

async function execute(action: { tool: string; args: Record<string, unknown> }): Promise<ExecutedStep> {
  const a = action.args ?? {};
  try {
    switch (action.tool) {
      case "create_entry":
        return await createTool(a);
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

async function createTool(args: Record<string, unknown>): Promise<ExecutedStep> {
  const type = String(args.type ?? "");
  if (!isEntryType(type)) return { tool: "create_entry", ok: false, summary: `Unknown type "${type}"` };
  const input = buildEntryInput(type, flatten(args));
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
  if (!fromId || !toId) return { tool: "connect_entries", ok: false, summary: "Need fromId and toId" };
  await addConnection(fromId, toId, args.note ? String(args.note) : null);
  return { tool: "connect_entries", ok: true, summary: "Linked two entries" };
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
      .filter((f) => !f.review)
      .map((f) => {
        if (f.kind === "select") return `${f.key}(one of: ${(f.options ?? []).filter(Boolean).join("|")})`;
        if (f.kind === "number") return `${f.key}(number)`;
        if (f.kind === "date") return `${f.key}(YYYY-MM-DD)`;
        return f.key;
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
  "- Infer and fill EVERY relevant field from the user's words. Be generous and specific: write a real title, a one-line summary, context/reasoning, and 2-4 lowercase tags.",
  "- For decisions, estimate a confidence (0-100) from how sure they sound.",
  "- Only use ids that appear in the context or in lookup results — never invent ids.",
  "- Use read tools first only when you need an existing id; otherwise act directly.",
  "- After your write actions are done, set done=true and give a short, friendly reply describing what you did.",
  "- If the user is just chatting or asking about their data, use read tools or none, answer in `reply`, and set done=true.",
  "- Never delete anything. Keep replies under ~3 sentences.",
].join("\n");

function parseAgent(raw: string): ParsedAgent | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const actions = Array.isArray(obj.actions)
      ? obj.actions.filter((x: unknown) => x && typeof (x as { tool?: unknown }).tool === "string")
      : [];
    return { actions, reply: typeof obj.reply === "string" ? obj.reply : undefined, done: Boolean(obj.done) };
  } catch {
    return null;
  }
}
