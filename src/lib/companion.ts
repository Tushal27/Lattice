import { jsonrepair } from "jsonrepair";
import { generate, generateDetailed, THINKING_PARTNER_SYSTEM } from "@/lib/ai";
import {
  decisionsAwaitingReview,
  entriesInRange,
  getEntry,
  listEntries,
  suggestConnections,
} from "@/lib/entries";
import { TYPES, reviewableTypeKeys } from "@/lib/types";
import { formatMoney, moneyAnalytics, type MoneyPeriod } from "@/lib/money";
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
  const [entries, dueDecisions, recent] = await Promise.all([
    entriesInRange(start, end),
    decisionsAwaitingReview(14),
    listEntries({ limit: 150 }),
  ]);

  if (entries.length === 0) {
    return {
      source: "local",
      count: 0,
      text: `Nothing was captured in ${label}. Even a single decision, question, or lesson gives future-you something to learn from.`,
    };
  }

  const openQuestions = recent.filter((e) => e.type === "question" && e.status === "open");

  const prompt = [
    `Here is everything I captured in Lattice over ${label}:`,
    "",
    digest(entries),
    dueDecisions.length
      ? `\nDecisions now old enough to review (I haven't graded them yet):\n${digest(dueDecisions)}`
      : "",
    openQuestions.length ? `\nMy open questions:\n${digest(openQuestions)}` : "",
    "",
    "Be my proactive weekly coach. In short markdown sections, cover:",
    "1. **What I learned** — the real takeaways",
    "2. **Best decision / insight** and **biggest risk or mistake**",
    "3. **Patterns** you notice across these entries (themes, repeated mistakes, emerging interests)",
    "4. **Review now** — name the specific decisions above I should go grade, and why",
    "5. **Connect these** — 1-2 specific pairs of my entries worth linking, and the insight that emerges",
    "6. **One question** worth sitting with this week",
    "Be specific and reference my actual entries by title. Tight and personal.",
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.75 });
  if (ai) return { source: "ai", count: entries.length, text: ai };

  return { source: "local", count: entries.length, text: localReflection(entries, label) };
}

const MONEY_PERIOD_LABEL: Record<MoneyPeriod, string> = {
  month: "this month",
  quarter: "this quarter",
  year: "this year",
  all: "all time",
};

// Each horizon asks a different question — the longer the lens, the more it's
// about judgment and behaviour rather than transactions.
const MONEY_FOCUS: Record<MoneyPeriod, string> = {
  month: "Focus on what created value vs. regret this month, and any spending drift.",
  quarter: "Focus on which financial beliefs/assumptions changed this quarter and why.",
  year: "Focus on the highest-ROI decisions, the wealth-building behaviours that worked, and the lessons that mattered most.",
  all: "Focus on the through-lines: what consistently works for me, what mistakes I keep repeating, and how my financial judgment has improved.",
};

/**
 * A financial-judgment reflection — not accounting. Surfaces the best money, the
 * most regretted, ROI patterns, and beliefs proven right/wrong, so spending
 * habits compound into wisdom.
 */
export async function moneyReflection(period: MoneyPeriod): Promise<SourcedText> {
  const a = await moneyAnalytics(period);
  const label = MONEY_PERIOD_LABEL[period] ?? "this month";

  if (a.spend.count === 0 && !a.best && !a.worst && a.goals.length === 0) {
    return {
      source: "local",
      text: `No money worth reflecting on ${label} yet. Log a few expenses or a financial decision and I'll start surfacing what actually pays off.`,
    };
  }

  const cats = a.byCategory
    .map((c) => `- ${c.category}: ${formatMoney(c.total)} across ${c.count}${c.avgValue != null ? ` · value ${c.avgValue.toFixed(1)} (-1 regret … +2 great)` : " · unrated"}`)
    .join("\n");
  const goals = a.goals.map((g) => `- ${g.title}: ${g.pct}% (${formatMoney(g.current)} / ${formatMoney(g.target)})`).join("\n");

  const prompt = [
    `My money for ${label}. Reflect on whether it bought a better life — this is about judgment, not accounting.`,
    "",
    `Remembered spend: ${formatMoney(a.spend.total)} across ${a.spend.count} logged.`,
    `Active investments: ${formatMoney(a.investments.total)} across ${a.investments.count}.`,
    a.best ? `Best-rated money: "${a.best.title}" (${formatMoney(a.best.amount)}).` : "",
    a.worst ? `Most regretted: "${a.worst.title}" (${formatMoney(a.worst.amount)}).` : "",
    cats ? `\nBy category:\n${cats}` : "",
    goals ? `\nGoals:\n${goals}` : "",
    a.awaitingReview ? `\n${a.awaitingReview} financial decisions/investments are old enough to grade but unreviewed.` : "",
    "",
    `In short markdown sections, be my financial-judgment coach. ${MONEY_FOCUS[period] ?? ""}`,
    "1. **Best money** — the spend/decision that most improved my life, and why.",
    "2. **Most regretted** — and the pattern behind it.",
    "3. **Where money buys me the most life** — the highest-ROI category/theme to lean into.",
    "4. **A belief proven right** and **a belief proven wrong** by how things turned out.",
    "5. **One money lesson** worth remembering.",
    "6. **One change** for next period.",
    "Reference my actual entries. Be specific, honest, and brief — no generic budgeting advice.",
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.7 });
  if (ai) return { source: "ai", text: ai };

  const lines = [
    `### Money reflection — ${label}`,
    "",
    `You logged **${formatMoney(a.spend.total)}** across ${a.spend.count}.`,
    a.best ? `- 🟢 Best: **${a.best.title}** (${formatMoney(a.best.amount)})` : "",
    a.worst ? `- 🔴 Most regretted: **${a.worst.title}** (${formatMoney(a.worst.amount)})` : "",
    cats ? `\n**By category**\n${cats}` : "",
    "",
    "_Add an AI key for a deeper, AI-written money reflection._",
  ].filter(Boolean);
  return { source: "local", text: lines.join("\n") };
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
  lines.push("", "_Connect an AI key (GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY) for a deeper, AI-written reflection._");
  return lines.join("\n");
}

/**
 * Analyzes the user's reviewed decisions to improve their judgment over time:
 * confidence calibration + what's common to right vs wrong calls + advice.
 */
export async function judgment(): Promise<SourcedText & { reviewedCount: number }> {
  // Spans all reviewable types — decisions, financial decisions, investments —
  // so judgment calibration covers money calls too.
  const pools = await Promise.all(reviewableTypeKeys().map((type) => listEntries({ type, limit: 300 })));
  const decisions = pools.flat();
  const reviewed = decisions
    .map((d) => ({ d, f: parseFields(d.fields) }))
    .filter((x) => x.f.reviewVerdict || x.f.reviewOutcome);

  if (reviewed.length < 3) {
    return {
      source: "local",
      reviewedCount: reviewed.length,
      text: `Review at least 3 decisions to unlock judgment analysis — you have ${reviewed.length} so far. Grade a few old calls (Review → "Decisions ready to judge") and I'll spot how well-calibrated you are.`,
    };
  }

  const rows = reviewed
    .map(({ d, f }) => {
      const conf = d.confidence != null ? `${d.confidence}%` : "—";
      const tags = (d.tags ?? []).map((t) => t.tag.name).join(",");
      return `- "${d.title}" | confidence ${conf} | verdict: ${f.reviewVerdict ?? "?"} | wouldRepeat: ${f.wouldRepeat ?? "?"} | expected: ${f.expected ?? "—"} | actual: ${f.reviewOutcome ?? "—"}${tags ? ` | tags: ${tags}` : ""}`;
    })
    .join("\n");

  const prompt = [
    "These are my reviewed decisions — what I predicted, how confident I was, and how they actually turned out:",
    "",
    rows,
    "",
    "Analyze my decision-making judgment. In short markdown sections:",
    "1. **Calibration** — is my confidence well-matched to outcomes? Am I over- or under-confident? Use the numbers.",
    "2. **My good calls have in common…** — patterns across decisions that went right (themes, tags, situations).",
    "3. **My bad calls have in common…** — patterns across decisions that went wrong.",
    "4. **Decide better** — 2 concrete, specific things I should do differently next time.",
    "Reference my actual decisions. Be honest and specific, not generic.",
  ].join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.6 });
  if (ai) return { source: "ai", reviewedCount: reviewed.length, text: ai };

  return {
    source: "local",
    reviewedCount: reviewed.length,
    text: "Add an AI key to analyze your judgment. Meanwhile, the Patterns page shows your verdict breakdown and average confidence.",
  };
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

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.7 });
  return {
    source: ai ? ("ai" as const) : ("local" as const),
    text:
      ai ??
      "These entries share tags or themes with this one — open them to see if a connection clicks.",
    suggestions,
  };
}

export interface Classification {
  source: "ai" | "local";
  type: string;
  title: string;
  summary: string;
  tags: string[];
}

/**
 * Turns a raw, unstructured thought into a suggested entry — which area it
 * belongs to, a clean title, a one-line summary, and tags. Falls back to a
 * keyword heuristic when AI is unavailable so quick-capture always works.
 */
export async function classifyThought(text: string): Promise<Classification> {
  const trimmed = text.trim();
  const prompt = [
    "Classify this raw thought into one Lattice area and structure it.",
    'Respond with ONLY a JSON object, no markdown, of the form:',
    '{"type":"decision|lesson|aha|question|project","title":"short clear title","summary":"one sentence","tags":["lowercase","tags"]}',
    "Pick the single best type. Keep the title under 12 words. 2-4 tags.",
    "The thought may contain typos or speech-to-text errors — read for intent and write a clean, correctly-spelled title and summary.",
    "",
    `Thought: """${trimmed}"""`,
  ].join("\n");

  const ai = await generate(prompt, { temperature: 0.3 });
  if (ai) {
    const parsed = safeJson(ai);
    if (parsed && typeof parsed.type === "string" && parsed.type in TYPES) {
      return {
        source: "ai",
        type: parsed.type,
        title: String(parsed.title ?? "").slice(0, 140) || trimmed.slice(0, 80),
        summary: String(parsed.summary ?? ""),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
      };
    }
  }

  return { source: "local", ...heuristicClassify(trimmed) };
}

function safeJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(jsonrepair(slice));
    } catch {
      return null;
    }
  }
}

function heuristicClassify(text: string): Omit<Classification, "source"> {
  const lower = text.toLowerCase();
  // Stems are matched at a word boundary but without a trailing one, so they
  // also catch inflected forms ("decid" → decided/deciding).
  let type = "lesson";
  if (text.includes("?") || /^(how|why|what|when|where|who|which|is|are|do|does|can)\b/.test(lower)) {
    type = "question";
  } else if (/\b(decid|chose|choos|opting|going with|will (use|go|take))/.test(lower)) {
    type = "decision";
  } else if (/\b(realiz|aha|clicked|it dawned|understood that|insight)/.test(lower)) {
    type = "aha";
  } else if (/\b(project|building|launch|shipping|working on)/.test(lower)) {
    type = "project";
  } else if (/\b(learn|lesson|mistake|should have|next time|note to self)/.test(lower)) {
    type = "lesson";
  }
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  const title = (firstSentence || text).slice(0, 80);
  return { type, title, summary: text.length > title.length ? text.slice(0, 200) : "", tags: [] };
}

export interface QuizItem {
  id: string;
  type: string;
  title: string;
  content: string;
}

/** One short active-recall question per note, for the Test Me feature. */
export async function quizBatch(items: QuizItem[]): Promise<Record<string, string>> {
  const fallback = () =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        i.type === "aha"
          ? `What was the insight behind "${i.title}"?`
          : `What did you take away from "${i.title}"?`,
      ]),
    );
  if (items.length === 0) return {};

  const prompt = [
    "For each of my notes below, write ONE short active-recall question that tests whether I remember the insight.",
    "Don't reveal the answer in the question. Respond with ONLY a JSON array of {\"id\":\"...\",\"q\":\"...\"}.",
    "",
    ...items.map((i) => `id ${i.id} [${i.type}] ${i.title} :: ${i.content.slice(0, 300)}`),
  ].join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.5 });
  if (!ai) return fallback();

  try {
    const cleaned = ai.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const arr = JSON.parse(jsonrepair(cleaned.slice(start, end + 1)));
    const out: Record<string, string> = {};
    for (const row of arr) {
      if (row && typeof row.id === "string" && typeof row.q === "string") out[row.id] = row.q;
    }
    // fill any missing with fallback
    for (const i of items) if (!out[i.id]) out[i.id] = fallback()[i.id];
    return out;
  } catch {
    return fallback();
  }
}

export async function askPartner(
  message: string,
  history: { role: string; text: string }[] = [],
  images: string[] = [],
): Promise<SourcedText & { provider?: string }> {
  const recent = await listEntries({ limit: 150 });
  const convo = history
    .slice(-10)
    .map((t) => `${t.role === "you" ? "Me" : "You"}: ${t.text}`)
    .join("\n");
  const prompt = [
    "Recent context from my personal operating system (my entries):",
    digest(recent),
    "",
    ...(convo ? ["Our conversation so far:", convo, ""] : []),
    images.length ? "(I've attached an image — read it and factor it into your reply.)" : "",
    "My new message:",
    message || "(see attached image)",
    "",
    "Reply as a continuation of our conversation — keep the thread, don't restart.",
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await generateDetailed(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.8, images });
  if (ai) return { source: "ai", text: ai.text, provider: ai.provider };

  return {
    source: "local",
    text: "The AI thinking partner needs an AI key to respond — set GROQ_API_KEY (recommended), OPENROUTER_API_KEY, or GEMINI_API_KEY. Once it's set, I'll draw on your decisions, lessons, and questions to think alongside you.",
  };
}
