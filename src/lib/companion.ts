import { jsonrepair } from "jsonrepair";
import { aiEnabled, generate, generateDetailed, streamText, THINKING_PARTNER_SYSTEM, WONDER_SYSTEM } from "@/lib/ai";
import { appGuide } from "@/lib/appGuide";
import {
  decisionsAwaitingReview,
  entriesInRange,
  getEntry,
  listEntries,
  relevantEntries,
  suggestConnections,
} from "@/lib/entries";
import { TYPES, reviewableTypeKeys } from "@/lib/types";
import { groupedCommitments } from "@/lib/commitments";
import { activeInsights } from "@/lib/insights";
import { calendarConnected, upcomingEvents } from "@/lib/calendar";
import { factsBlock } from "@/lib/memory";
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

export type BriefKind = "auto" | "morning" | "evening";

function resolveKind(kind: BriefKind): "morning" | "evening" {
  if (kind !== "auto") return kind;
  return new Date().getHours() < 16 ? "morning" : "evening";
}

async function calendarLines(): Promise<{ today: string[]; count: number; nextContext: string }> {
  try {
    if (!(await calendarConnected())) return { today: [], count: 0, nextContext: "" };
    const events = await upcomingEvents({ days: 2, max: 12 });
    const todayStr = new Date().toDateString();
    const todayEvents = events.filter((e) => e.start && new Date(e.start).toDateString() === todayStr);
    const today = todayEvents.map((e) => {
      const t = e.allDay
        ? "all day"
        : new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `- ${t} · ${e.summary}${e.location ? ` @ ${e.location}` : ""}`;
    });

    // Meeting prep: for the next still-upcoming, non-all-day event, pull what the
    // user's brain already knows that's relevant — so the brief preps them.
    let nextContext = "";
    const now = Date.now();
    const next = todayEvents.find((e) => !e.allDay && e.start && new Date(e.start).getTime() > now);
    if (next?.summary) {
      const related = await relevantEntries(next.summary, 3);
      if (related.length) {
        const when = new Date(next.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        nextContext = `Prep for your next meeting ("${next.summary}" at ${when}) — what I already know that's relevant:\n${digest(related)}`;
      }
    }
    return { today, count: today.length, nextContext };
  } catch {
    return { today: [], count: 0, nextContext: "" };
  }
}

/**
 * The brief — my Jarvis reads the state of my whole world (calendar, commitments,
 * decisions to judge, live insights, money) and writes a short, prioritized,
 * human briefing. Morning looks ahead; evening looks back + sets up tomorrow.
 * Deterministic local fallback always works.
 */
export async function dailyBrief(kind: BriefKind = "auto"): Promise<SourcedText> {
  const when = resolveKind(kind);
  const [commitments, toReview, insights, money, cal] = await Promise.all([
    groupedCommitments(),
    decisionsAwaitingReview(14),
    activeInsights(6),
    moneyAnalytics("month"),
    calendarLines(),
  ]);

  const dueNow = [...commitments.overdue, ...commitments.today];

  const nothing =
    dueNow.length === 0 && toReview.length === 0 && insights.length === 0 && commitments.upcoming.length === 0 && cal.count === 0;
  if (nothing) {
    return {
      source: "local",
      text:
        when === "evening"
          ? "Quiet evening — nothing overdue, nothing waiting. A good moment to capture a lesson from today."
          : "Your day is wide open — nothing due, nothing waiting to be judged. Good time to set an intention or capture a decision.",
    };
  }

  const facts = [
    cal.count ? `On my calendar today:\n${cal.today.join("\n")}` : "",
    when === "morning" && cal.nextContext ? cal.nextContext : "",
    dueNow.length
      ? `Commitments due now (${dueNow.length}):\n${dueNow.map((c) => `- ${c.title}${commitments.overdue.some((o) => o.id === c.id) ? " (OVERDUE)" : " (today)"}`).join("\n")}`
      : "",
    commitments.upcoming.length
      ? `Coming up soon:\n${commitments.upcoming.slice(0, 3).map((c) => `- ${c.title}`).join("\n")}`
      : "",
    when === "evening" && commitments.done.length
      ? `Closed out today:\n${commitments.done.slice(0, 5).map((c) => `- ${c.title}`).join("\n")}`
      : "",
    toReview.length
      ? `Decisions old enough to judge (${toReview.length}):\n${toReview.slice(0, 5).map((d) => `- ${d.title}`).join("\n")}`
      : "",
    insights.length
      ? `Live insights from my system:\n${insights.map((i) => `- [${i.type}] ${i.title}: ${i.body}`).join("\n")}`
      : "",
    money.spend.count
      ? `Money this month: spent ${formatMoney(money.spend.total)} across ${money.spend.count}${money.worst ? `; most regretted "${money.worst.title}" (${formatMoney(money.worst.amount)})` : ""}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const intro =
    when === "evening"
      ? "It's evening. You are my Jarvis. Read the state of my world below and write my evening brief: a short, honest look back at today and a calm setup for tomorrow."
      : "It's morning. You are my Jarvis. Read the state of my world below and write my morning brief for the day ahead.";

  const closing =
    when === "evening"
      ? "Acknowledge what got done, gently flag what slipped, name anything worth reflecting on, then point at the one thing that matters most tomorrow. Warm, specific, under ~150 words. No headers, no filler."
      : "Open with one warm, specific line about where I stand. Surface what matters most today and why — anything overdue, risky, or time-sensitive first, and weave in my calendar. End with the single most useful thing to do next. Concrete, reference my actual items, under ~150 words. No headers, no filler.";

  const ai = await generate([intro, "", facts, "", closing].join("\n"), { system: WONDER_SYSTEM, temperature: 0.6 });
  if (ai) return { source: "ai", text: ai.trim() };

  // Deterministic local fallback.
  const parts: string[] = [];
  if (cal.count) parts.push(`📅 ${cal.count} on your calendar today: ${cal.today.map((l) => l.replace(/^- /, "")).slice(0, 3).join("; ")}.`);
  if (dueNow.length) {
    const overdue = commitments.overdue.length;
    parts.push(`🎯 **${dueNow.length}** ${dueNow.length === 1 ? "commitment" : "commitments"} due${overdue ? ` — ${overdue} overdue` : ""}: ${dueNow.slice(0, 3).map((c) => c.title).join(", ")}.`);
  }
  if (when === "evening" && commitments.done.length) parts.push(`✅ Closed out ${commitments.done.length} today.`);
  if (toReview.length) parts.push(`⏳ **${toReview.length}** ${toReview.length === 1 ? "decision" : "decisions"} ready to judge.`);
  if (insights.length) parts.push(`💡 ${insights.length} live ${insights.length === 1 ? "insight" : "insights"}: ${insights[0].title}.`);
  if (money.spend.count) parts.push(`💰 ${formatMoney(money.spend.total)} spent this month across ${money.spend.count}.`);
  return { source: "local", text: parts.join("\n\n") || "Nothing pressing right now." };
}

export interface EmailExtraction {
  messageId: string;
  // commitment = a concrete thing I need to do/follow up; skip = nothing actionable.
  kind: "commitment" | "skip";
  title: string;
  summary: string;
  due: string; // natural-language due hint ("Friday", "tomorrow 5pm") or ""
}

/**
 * Reads recent emails and pulls out the few that contain a genuine action item
 * or commitment for me — so my inbox quietly feeds my follow-throughs instead of
 * rotting. Returns one row per message (kind "skip" when nothing actionable).
 */
export async function extractFromEmails(
  messages: { id: string; from: string; subject: string; snippet: string; body: string }[],
): Promise<EmailExtraction[]> {
  if (messages.length === 0) return [];

  const blocks = messages
    .map(
      (m, i) =>
        `--- EMAIL ${i} (id: ${m.id}) ---\nFrom: ${m.from}\nSubject: ${m.subject}\nBody: ${(m.body || m.snippet).slice(0, 1500)}`,
    )
    .join("\n\n");

  const prompt = [
    "Below are recent emails from my inbox. For EACH email, decide if it contains a concrete action item or commitment I personally need to follow through on (a deadline, a reply owed, a task, a bill, an appointment).",
    "Ignore newsletters, marketing, notifications, and FYI-only mail — mark those as skip.",
    "",
    blocks,
    "",
    'Respond with ONLY a JSON array, one object per email, of the form:',
    '{"id":"<email id>","kind":"commitment|skip","title":"short imperative task","summary":"one line of context","due":"natural-language deadline if any, else empty"}',
    "Keep titles short and imperative (e.g. \"Reply to Anna about the lease\"). Be conservative — only flag real commitments.",
  ].join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.2 });
  if (!ai) return messages.map((m) => ({ messageId: m.id, kind: "skip" as const, title: "", summary: "", due: "" }));

  const cleaned = ai.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(jsonrepair(cleaned.slice(start, end + 1)));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .map((row): EmailExtraction | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      if (!id) return null;
      return {
        messageId: id,
        kind: r.kind === "commitment" ? "commitment" : "skip",
        title: String(r.title ?? "").slice(0, 140),
        summary: String(r.summary ?? "").slice(0, 280),
        due: String(r.due ?? "").slice(0, 80),
      };
    })
    .filter((x): x is EmailExtraction => x !== null);
}

export interface EmailTriage {
  messageId: string;
  kind: "commitment" | "reply" | "renewal" | "spend" | "skip";
  title: string;
  summary: string;
  due: string; // for commitments
  draft: string; // a full draft reply, for kind === "reply"
  amount: number; // for spend: the amount charged
  category: string; // for spend: a best-guess category
}

/**
 * Reads recent emails and triages each: a commitment (action item), a reply
 * (someone's waiting on me — with a full drafted response), a renewal (a
 * subscription/bill about to charge), or skip. One AI pass over the batch.
 */
export async function triageEmails(
  messages: { id: string; from: string; subject: string; snippet: string; body: string }[],
): Promise<EmailTriage[]> {
  if (messages.length === 0) return [];

  const blocks = messages
    .map(
      (m, i) =>
        `--- EMAIL ${i} (id: ${m.id}) ---\nFrom: ${m.from}\nSubject: ${m.subject}\nBody: ${(m.body || m.snippet).slice(0, 1800)}`,
    )
    .join("\n\n");

  const prompt = [
    "Triage each email below into exactly one kind:",
    "- commitment: it implies a concrete task/deadline I personally must do.",
    "- reply: a real person is waiting for my response. Write a complete, polite, ready-to-send draft reply in my voice (greeting + body + sign-off). Do NOT invent facts I haven't given — keep it reasonable and brief.",
    "- renewal: a subscription/bill ABOUT TO charge or renew (a heads-up, not a completed payment).",
    "- spend: a COMPLETED transaction/payment/debit notification (bank, UPI, GPay, card, receipt) — money already left my account. Extract the amount (number only) and a best-guess category (Essentials, Food, Health, Learning, Tools/Software, Family, Experiences, Lifestyle, Transport, Other).",
    "- skip: newsletters, marketing, notifications, FYI-only, automated noise.",
    "Be conservative; most promotional mail is skip.",
    "",
    blocks,
    "",
    'Respond with ONLY a JSON array, one object per email:',
    '{"id":"<email id>","kind":"commitment|reply|renewal|spend|skip","title":"short label (for spend: the merchant/payee)","summary":"one line of context","due":"natural-language deadline if a commitment, else empty","draft":"the full reply text if kind is reply, else empty","amount":<number for spend, else 0>,"category":"category for spend, else empty"}',
  ].join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.3 });
  if (!ai) return messages.map((m) => ({ messageId: m.id, kind: "skip" as const, title: "", summary: "", due: "", draft: "", amount: 0, category: "" }));

  const cleaned = ai.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(jsonrepair(cleaned.slice(start, end + 1)));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const valid = new Set(["commitment", "reply", "renewal", "spend", "skip"]);
  return arr
    .map((row): EmailTriage | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      if (!id) return null;
      const kind = valid.has(String(r.kind)) ? (String(r.kind) as EmailTriage["kind"]) : "skip";
      const amount = Number(r.amount);
      return {
        messageId: id,
        kind,
        title: String(r.title ?? "").slice(0, 140),
        summary: String(r.summary ?? "").slice(0, 280),
        due: String(r.due ?? "").slice(0, 80),
        draft: String(r.draft ?? "").slice(0, 4000),
        amount: Number.isFinite(amount) ? amount : 0,
        category: String(r.category ?? "").slice(0, 40),
      };
    })
    .filter((x): x is EmailTriage => x !== null);
}

/**
 * Draft a strong first-pass answer to an open question — grounded in the user's
 * own relevant notes plus the model's reasoning. Robust: works with just an AI
 * key (no external search dependency); returns null only if the AI is down.
 */
export async function researchQuestion(title: string, summary = ""): Promise<string | null> {
  const related = await relevantEntries(`${title} ${summary}`.trim(), 8);
  const prompt = [
    "I captured this open question and want a strong first-draft answer to react to and refine.",
    `Question: ${title}${summary ? `\nContext: ${summary}` : ""}`,
    related.length ? `\nFrom my own notes that may be relevant:\n${digest(related)}` : "",
    "",
    "Write a clear, well-reasoned draft: take a position, lay out the key considerations/options and trade-offs, and end with a concrete recommendation or next step. Ground it in my notes where they're relevant, be honest about uncertainty, and keep it tight and genuinely useful — this is a draft I'll refine, not a final answer.",
  ]
    .filter(Boolean)
    .join("\n");
  return generate(prompt, { system: WONDER_SYSTEM, temperature: 0.6 });
}

export interface ExtractedPerson {
  entryId: string;
  name: string;
  context: string;
}

/**
 * Pull the real people (not the user) mentioned across a batch of entries, each
 * with a short note on who they are / the relationship — for CRM-lite.
 */
export async function extractPeople(
  entries: { id: string; type: string; title: string; summary: string | null; fields: string | null }[],
): Promise<ExtractedPerson[]> {
  if (entries.length === 0) return [];
  const blocks = entries
    .map((e) => {
      const f = parseFields(e.fields);
      const extra = Object.values(f).join(" ").slice(0, 400);
      return `id ${e.id}: [${e.type}] ${e.title}${e.summary ? ` — ${e.summary}` : ""} ${extra}`.trim();
    })
    .join("\n");

  const prompt = [
    "From my notes below, extract the real PEOPLE mentioned (not me, not companies/tools). For each, give their name and a short note on who they are or my relationship/context with them.",
    "Skip generic roles with no name. Be conservative — only clear, named people.",
    "",
    blocks,
    "",
    'Respond with ONLY a JSON array: [{"id":"<the entry id it came from>","name":"Full Name","context":"who they are / what about them"}]. Empty array if none.',
  ].join("\n");

  const ai = await generate(prompt, { temperature: 0.2 });
  if (!ai) return [];
  const cleaned = ai.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(jsonrepair(cleaned.slice(start, end + 1)));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((r): ExtractedPerson | null => {
        if (!r || typeof r !== "object") return null;
        const o = r as Record<string, unknown>;
        const name = String(o.name ?? "").trim();
        if (!name || name.length > 80) return null;
        return { entryId: String(o.id ?? ""), name, context: String(o.context ?? "").slice(0, 280) };
      })
      .filter((x): x is ExtractedPerson => x !== null);
  } catch {
    return [];
  }
}

export interface SpendAnalysis {
  isTransaction: boolean;
  debit: boolean;
  amount: number;
  merchant: string;
  category: string;
  thought: string;
}

// A compact picture of recent spending + the user's values, so a per-transaction
// "worth it?" thought is grounded in their actual patterns, not generic advice.
async function spendContextString(): Promise<string> {
  const a = await moneyAnalytics("month");
  const cats = a.byCategory
    .slice(0, 5)
    .map((c) => `${c.category} ${formatMoney(c.total)}${c.avgValue != null ? ` (value ${c.avgValue.toFixed(1)})` : ""}`)
    .join(", ");
  const recent = a.allSpends
    .slice(0, 6)
    .map((s) => `${s.title} ${formatMoney(s.amount)}${s.score != null ? ` (${s.score >= 1 ? "worth it" : s.score <= -1 ? "regret" : "mixed"})` : ""}`)
    .join("; ");
  const facts = await factsBlock(6);
  return [
    `This month: ${formatMoney(a.spend.total)} across ${a.spend.count}.`,
    cats ? `By category: ${cats}.` : "",
    recent ? `Recent spends: ${recent}.` : "",
    facts ? `What matters to me:\n${facts}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse a bank/UPI/card SMS AND form a short, grounded "worth it?" thought in one
 * pass. Returns null for non-transaction texts (OTPs, promos, balance, credits).
 */
export async function analyzeSpendSms(text: string): Promise<SpendAnalysis | null> {
  // Cheap pre-filter so we don't burn an AI call on OTPs/promos.
  if (!/(debit|spent|paid|sent|purchase|txn|transaction|deducted|withdraw|rs\.?|inr|₹|upi)/i.test(text)) return null;

  const ctx = await spendContextString();
  const prompt = [
    "This is a bank/UPI/card SMS. If it's a COMPLETED outgoing payment (a debit — money left my account), extract it and give me a short, honest 'worth it?' thought grounded in my spending context below. If it's NOT an outgoing debit (OTP, promo, balance, a credit/refund/received money), set isTransaction to false.",
    "",
    `My spending context:\n${ctx}`,
    "",
    `SMS: """${text.slice(0, 600)}"""`,
    "",
    'Respond with ONLY JSON: {"isTransaction":true|false,"debit":true|false,"amount":<number>,"merchant":"who I paid","category":"Essentials|Food|Health|Learning|Tools/Software|Family|Experiences|Lifestyle|Transport|Other","thought":"1-2 sentences, specific and honest: does this fit my patterns/values? a streak worth noticing? Never preachy or generic."}',
  ].join("\n");

  const ai = await generate(prompt, { system: THINKING_PARTNER_SYSTEM, temperature: 0.4 });
  if (!ai) return null;
  const parsed = safeJson(ai);
  if (!parsed) return null;
  const amount = Number(parsed.amount);
  return {
    isTransaction: parsed.isTransaction === true,
    debit: parsed.debit !== false,
    amount: Number.isFinite(amount) ? amount : 0,
    merchant: String(parsed.merchant ?? "Payment").slice(0, 100),
    category: String(parsed.category ?? "Other").slice(0, 40),
    thought: String(parsed.thought ?? "").slice(0, 400),
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

/**
 * Distills a longer piece of external content (an article, a file, a repo
 * snapshot) into ONE structured knowledge entry — a clean title, a real
 * distillation of the key takeaways, the best-fit type, and tags. Falls back to
 * the local heuristic so ingestion always produces something.
 */
export async function extractKnowledge(
  text: string,
  ctx: { source: string; title?: string } = { source: "content" },
): Promise<Classification> {
  const trimmed = text.trim().slice(0, 6000);
  if (!trimmed) return { source: "local", ...heuristicClassify(ctx.title ?? "") };

  const prompt = [
    `I'm saving content from ${ctx.source}${ctx.title ? ` titled "${ctx.title}"` : ""} into Lattice (my second brain). Distill it into ONE knowledge entry.`,
    "Respond with ONLY a JSON object, no markdown:",
    '{"type":"lesson|aha|question|decision|project|snippet","title":"short clear title","summary":"2-4 sentence distillation of the real takeaways — not a description of the document","tags":["lowercase","tags"]}',
    "Pick the single best type (prefer lesson or aha for articles/notes, snippet for code). Title under 12 words. 3-5 tags.",
    "Capture what's actually USEFUL to remember, in my voice — not 'this article discusses…'.",
    "",
    `Content:\n"""${trimmed}"""`,
  ].join("\n");

  const ai = await generate(prompt, { temperature: 0.3 });
  if (ai) {
    const parsed = safeJson(ai);
    if (parsed) {
      const type = typeof parsed.type === "string" && parsed.type in TYPES ? parsed.type : "lesson";
      return {
        source: "ai",
        type,
        title: String(parsed.title ?? ctx.title ?? "").slice(0, 140) || (ctx.title ?? trimmed.slice(0, 80)),
        summary: String(parsed.summary ?? ""),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
      };
    }
  }

  const base = heuristicClassify(ctx.title ? `${ctx.title}. ${trimmed}` : trimmed);
  return { source: "local", ...base, title: ctx.title?.slice(0, 140) || base.title };
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

// Assemble the grounded Wonder prompt: app guide + carried memory + the entries
// most semantically relevant to the message + the running conversation. Shared
// by the blocking and streaming paths so they stay identical.
async function buildAskPrompt(
  message: string,
  history: { role: string; text: string }[],
  memory: string,
  hasImages: boolean,
): Promise<string> {
  const [context, facts] = await Promise.all([
    message.trim() ? relevantEntries(message, 12) : listEntries({ limit: 12 }),
    factsBlock(16),
  ]);
  const convo = history
    .slice(-10)
    .map((t) => `${t.role === "you" ? "Me" : "You"}: ${t.text}`)
    .join("\n");
  return [
    appGuide(),
    "",
    ...(facts ? ["Durable facts about me (long-term memory):", facts, ""] : []),
    ...(memory ? ["What I remember from our earlier chats (carried memory):", memory, ""] : []),
    "Context from my Lattice — the entries (decisions, lessons, aha moments, questions, projects) most relevant to my message:",
    context.length ? digest(context) : "(nothing captured yet)",
    "",
    ...(convo ? ["Our conversation so far:", convo, ""] : []),
    hasImages ? "(I've attached an image — read it and factor it into your reply.)" : "",
    "My message:",
    message || "(see attached image)",
    "",
    "Give me your best, well-reasoned answer. Use the context above where it's genuinely relevant; otherwise just answer well. Continue our thread, don't restart.",
  ]
    .filter(Boolean)
    .join("\n");
}

const ASK_NO_AI =
  "The AI thinking partner needs an AI key to respond — set GROQ_API_KEY (recommended), OPENROUTER_API_KEY, or GEMINI_API_KEY. Once it's set, I'll draw on your decisions, lessons, and questions to think alongside you.";

export async function askPartner(
  message: string,
  history: { role: string; text: string }[] = [],
  images: string[] = [],
  memory = "",
): Promise<SourcedText & { provider?: string }> {
  const prompt = await buildAskPrompt(message, history, memory, images.length > 0);
  const ai = await generateDetailed(prompt, { system: WONDER_SYSTEM, temperature: 0.7, images });
  if (ai) return { source: "ai", text: ai.text, provider: ai.provider };
  return { source: "local", text: ASK_NO_AI };
}

/**
 * Streaming Wonder: yields the same grounded answer token-by-token for instant
 * time-to-first-token. Falls back to a single message if no provider responds.
 */
export async function* askPartnerStream(
  message: string,
  history: { role: string; text: string }[] = [],
  memory = "",
): AsyncGenerator<string, void, unknown> {
  if (!aiEnabled()) {
    yield ASK_NO_AI;
    return;
  }
  const prompt = await buildAskPrompt(message, history, memory, false);
  let any = false;
  for await (const chunk of streamText(prompt, { system: WONDER_SYSTEM, temperature: 0.7 })) {
    any = true;
    yield chunk;
  }
  if (!any) yield "I couldn't reach the AI engine just now — please try again.";
}

/**
 * Pull durable, reusable facts about the user out of a conversation — stable
 * preferences, ongoing projects, recurring constraints — for the structured
 * memory store. Returns a short list of terse, self-contained statements.
 */
export async function extractFacts(messages: { role: string; text: string }[]): Promise<string[]> {
  const convo = messages
    .filter((m) => m.text?.trim())
    .map((m) => `${m.role === "you" ? "Me" : "You"}: ${m.text}`)
    .join("\n");
  if (!convo.trim()) return [];

  const prompt = [
    "From this conversation, extract any DURABLE facts about me worth remembering long-term —",
    "stable preferences, ongoing projects/goals, recurring constraints, tools I use, people/roles.",
    "Ignore one-off or transient details. Each fact must stand on its own without the conversation.",
    'Respond with ONLY a JSON array of short strings (max 8), e.g. ["Prefers concise answers","Building Lattice, a personal OS"]. Empty array if nothing durable.',
    "",
    convo,
  ].join("\n");

  const ai = await generate(prompt, { temperature: 0.2 });
  if (!ai) return [];
  const cleaned = ai.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(jsonrepair(cleaned.slice(start, end + 1)));
    return Array.isArray(arr) ? arr.map(String).filter((s) => s.trim().length > 3).slice(0, 8) : [];
  } catch {
    return [];
  }
}

/**
 * Fold a conversation into a short rolling "memory" that carries into the next
 * thread — so the chat isn't a hoard of transcripts, just a working memory.
 */
export async function summarizeChat(
  messages: { role: string; text: string }[],
  priorMemory = "",
): Promise<string> {
  const convo = messages
    .filter((m) => m.text?.trim())
    .map((m) => `${m.role === "you" ? "Me" : "You"}: ${m.text}`)
    .join("\n");
  if (!convo.trim()) return priorMemory.slice(0, 1500);

  const prompt = [
    priorMemory ? `Memory so far:\n${priorMemory}\n` : "",
    "Conversation to fold into memory:",
    convo,
    "",
    "Update my running memory of these chats into a SHORT note (3–6 sentences, no preamble): what I was exploring, any conclusions or decisions, open threads, and useful facts about me. MERGE with the memory so far and keep it tight — drop stale detail. Write as notes to future-you.",
  ]
    .filter(Boolean)
    .join("\n");

  const ai = await generate(prompt, { system: WONDER_SYSTEM, temperature: 0.4 });
  if (ai) return ai.trim().slice(0, 1500);

  // Local fallback: keep prior memory + the last few things I said.
  const lastSaid = messages
    .filter((m) => m.role === "you" && m.text?.trim())
    .slice(-3)
    .map((m) => m.text)
    .join(" • ");
  return `${priorMemory ? priorMemory + " " : ""}${lastSaid}`.slice(0, 1500);
}
