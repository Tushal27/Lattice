import { geminiGenerate, THINKING_PARTNER_SYSTEM } from "@/lib/ai";
import { entriesInRange, getEntry, listEntries, suggestConnections } from "@/lib/entries";
import { TYPES } from "@/lib/types";
import { parseFields } from "@/lib/utils";

type SourcedText = { source: "ai" | "local"; text: string };

interface EntryLike {
  type: string;
  title: string;
  summary: string | null;
  fields: string | null;
  status?: string | null;
  createdAt?: Date;
}

function digest(entries: EntryLike[]): string {
  return entries
    .map((e) => {
      const f = parseFields(e.fields);
      const extra = Object.entries(f)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      const label = TYPES[e.type as keyof typeof TYPES]?.label ?? e.type;
      return `- [${label}] ${e.title}${e.summary ? ` — ${e.summary}` : ""}${extra ? ` (${extra})` : ""}`;
    })
    .join("\n");
}

export function rangeFor(period: "week" | "month"): { start: Date; end: Date; label: string } {
  const end = new Date();
  const start = new Date();
  if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return { start, end, label: period === "week" ? "the past week" : "the past month" };
}

export async function reflection(period: "week" | "month"): Promise<SourcedText & { count: number }> {
  const { start, end, label } = rangeFor(period);
  const entries = await entriesInRange(start, end);

  if (entries.length === 0) {
    return {
      source: "local",
      count: 0,
      text: `Nothing was captured in ${label}. Even a single decision, question, or lesson gives future-you something to learn from.`,
    };
  }

  const prompt = [
    `Here is everything I captured in Lattice over ${label}:`,
    "",
    digest(entries),
    "",
    "Reflect with me. In short sections, cover:",
    "1. What I seem to have learned",
    "2. My best decision or insight",
    "3. The biggest mistake or risk",
    "4. A pattern you notice across these entries",
    "5. One open question worth sitting with",
    "Keep it tight and personal. Use markdown headings.",
  ].join("\n");

  const ai = await geminiGenerate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.8 });
  if (ai) return { source: "ai", count: entries.length, text: ai };

  return { source: "local", count: entries.length, text: localReflection(entries, label) };
}

function localReflection(entries: EntryLike[], label: string): string {
  const byType: Record<string, EntryLike[]> = {};
  for (const e of entries) (byType[e.type] ??= []).push(e);
  const lines: string[] = [`### Reflecting on ${label}`, ""];
  lines.push(`You captured **${entries.length}** ${entries.length === 1 ? "entry" : "entries"}.`);
  for (const [type, items] of Object.entries(byType)) {
    const cfg = TYPES[type as keyof typeof TYPES];
    lines.push("", `**${cfg?.plural ?? type}** (${items.length})`);
    for (const i of items) lines.push(`- ${i.title}`);
  }
  const open = entries.filter((e) => e.type === "question" && e.status === "open");
  if (open.length) {
    lines.push("", "### Open questions to sit with");
    for (const q of open) lines.push(`- ${q.title}`);
  }
  lines.push("", "_Add a GEMINI_API_KEY to get a deeper, AI-written reflection._");
  return lines.join("\n");
}

export async function connectionInsight(entryId: string) {
  const entry = await getEntry(entryId);
  if (!entry) return { source: "local" as const, text: "Entry not found.", suggestions: [] };

  const suggestions = await suggestConnections(entryId, 6);

  if (suggestions.length === 0) {
    return {
      source: "local" as const,
      text: "No related entries yet. As you capture more, Lattice will start spotting connections.",
      suggestions,
    };
  }

  const prompt = [
    "This is one of my entries:",
    digest([entry]),
    "",
    "Here are other entries from my system that might relate to it:",
    digest(suggestions),
    "",
    "For the 2-3 most meaningful links, tell me in one sentence each WHY they connect",
    "and what insight emerges from seeing them together. Be specific.",
  ].join("\n");

  const ai = await geminiGenerate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.7 });
  return {
    source: ai ? ("ai" as const) : ("local" as const),
    text:
      ai ??
      "These entries share tags or themes with this one — open them to see if a connection clicks.",
    suggestions,
  };
}

export async function askPartner(message: string): Promise<SourcedText> {
  const recent = await listEntries({ limit: 40 });
  const prompt = [
    "Here is recent context from my personal operating system:",
    digest(recent),
    "",
    "My message to you:",
    message,
  ].join("\n");

  const ai = await geminiGenerate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.8 });
  if (ai) return { source: "ai", text: ai };

  return {
    source: "local",
    text: "The AI thinking partner needs a GEMINI_API_KEY to respond. Once it's set, I'll draw on your decisions, lessons, and questions to think alongside you.",
  };
}
