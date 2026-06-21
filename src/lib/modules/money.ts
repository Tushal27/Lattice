// Money OS — a first-class Lattice module optimizing for FINANCIAL JUDGMENT,
// not bookkeeping. The recurring question it answers isn't "where did my money
// go?" but "did this spending actually improve my life?". Financial decisions and
// investments are `reviewable` (they inherit Expected-vs-Actual, would-repeat,
// and judgment calibration from the core review engine); expenses carry a
// satisfaction signal at capture; "money lessons" are just core Lessons tagged
// #money (one shared brain). Amounts live in the `amount` field and are parsed by
// src/lib/money.ts.

import type { ModuleConfig, TypeConfig } from "@/lib/types";

const SATISFACTION = ["", "Regret", "Meh", "Worth it", "Great"];

const financialDecision: TypeConfig = {
  type: "financial-decision",
  label: "Financial Decision",
  plural: "Financial Decisions",
  slug: "money-decisions",
  icon: "🏦",
  accent: "amber",
  tagline: "Significant money choices — judged later, not just recorded.",
  intro: "A meaningful money decision. Capture the cost and the reasoning now; grade whether it was worth it later.",
  reviewable: true,
  fields: [
    { key: "title", label: "The decision", kind: "text", column: true, placeholder: "Subscribe to Claude Code" },
    { key: "amount", label: "Cost", kind: "number", placeholder: "2200" },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "reasoning", label: "Reasoning", kind: "textarea", placeholder: "Why you're spending this" },
    { key: "expected", label: "Expected value", kind: "textarea", placeholder: "What you expect to get out of it" },
    { key: "confidence", label: "Confidence (0–100)", kind: "number", column: true, help: "How sure are you this is worth it?" },
    { key: "occurredAt", label: "Date", kind: "date", column: true },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "reviewOutcome", label: "What it actually delivered", kind: "textarea", review: true, placeholder: "Review later" },
    { key: "reviewVerdict", label: "Was it worth it?", kind: "select", review: true, options: ["", "Right call", "Mixed", "Wrong call", "Too early to tell"] },
    { key: "wouldRepeat", label: "Would you spend it again?", kind: "select", review: true, options: ["", "Yes", "No", "Not sure"] },
    { key: "reviewLearning", label: "What you'd do differently", kind: "textarea", review: true },
  ],
};

const expense: TypeConfig = {
  type: "expense",
  label: "Expense",
  plural: "Expenses",
  slug: "expenses",
  icon: "🧾",
  accent: "rose",
  tagline: "Only the spending worth remembering — with how it felt.",
  intro: "Not every transaction — just spending worth remembering. Tag how worth-it it felt; that's the signal that compounds.",
  fields: [
    { key: "title", label: "What you bought", kind: "text", column: true, placeholder: "Bought mum a phone" },
    { key: "amount", label: "Amount", kind: "number", placeholder: "18000" },
    { key: "category", label: "Category", kind: "select", options: ["", "Essentials", "Health", "Learning", "Tools/Software", "Family", "Experiences", "Lifestyle", "Other"] },
    { key: "recurring", label: "Recurring?", kind: "select", options: ["one-time", "monthly", "yearly"] },
    { key: "satisfaction", label: "Worth it?", kind: "select", options: SATISFACTION, help: "How it felt in hindsight" },
    { key: "summary", label: "Purpose / note", kind: "text", column: true, placeholder: "Why / what for" },
    { key: "details", label: "Details", kind: "textarea" },
    { key: "occurredAt", label: "When", kind: "date", column: true },
  ],
};

const investment: TypeConfig = {
  type: "investment",
  label: "Investment",
  plural: "Investments",
  slug: "investments",
  icon: "📈",
  accent: "emerald",
  tagline: "Investments and the theses behind them.",
  intro: "Money put to work — with the thesis for why it'll pay off, so you can grade the thinking later.",
  reviewable: true,
  fields: [
    { key: "title", label: "The investment", kind: "text", column: true, placeholder: "Flexi cap fund SIP" },
    { key: "amount", label: "Amount", kind: "number", placeholder: "1000", help: "Per installment for a SIP, or total for a lump sum." },
    { key: "frequency", label: "Frequency", kind: "select", options: ["one-time", "monthly", "quarterly", "yearly"] },
    { key: "thesis", label: "Thesis — why it'll pay off", kind: "textarea" },
    { key: "horizon", label: "Time horizon", kind: "select", options: ["", "<1 year", "1–3 years", "3–10 years", "10+ years"] },
    { key: "risk", label: "Risk level", kind: "select", options: ["", "Low", "Medium", "High"] },
    { key: "status", label: "Status", kind: "select", column: true, options: ["active", "exited"] },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "occurredAt", label: "Started", kind: "date", column: true },
    { key: "details", label: "Details", kind: "textarea" },
    { key: "reviewOutcome", label: "How it played out", kind: "textarea", review: true, placeholder: "Review later" },
    { key: "reviewVerdict", label: "Did the thesis hold?", kind: "select", review: true, options: ["", "Right call", "Mixed", "Wrong call", "Too early to tell"] },
    { key: "wouldRepeat", label: "Would you invest again?", kind: "select", review: true, options: ["", "Yes", "No", "Not sure"] },
    { key: "reviewLearning", label: "What you learned", kind: "textarea", review: true },
  ],
};

const goal: TypeConfig = {
  type: "goal",
  label: "Financial Goal",
  plural: "Financial Goals",
  slug: "money-goals",
  icon: "🪙",
  accent: "cyan",
  tagline: "Targets you're building toward.",
  intro: "A savings or money target. Pair it with a recurring commitment to actually feed it.",
  fields: [
    { key: "title", label: "The goal", kind: "text", column: true, placeholder: "6-month emergency fund" },
    { key: "amount", label: "Target", kind: "number", placeholder: "300000" },
    { key: "current", label: "Saved so far", kind: "number", placeholder: "75000" },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "status", label: "Status", kind: "select", column: true, options: ["active", "reached", "abandoned"] },
    { key: "motivation", label: "Why it matters", kind: "textarea" },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "details", label: "Details", kind: "textarea" },
  ],
};

export const moneyModule: ModuleConfig = {
  id: "money",
  name: "Money OS",
  icon: "💰",
  accent: "amber",
  tagline: "Spending, decisions, and investments — judged by the life value they create.",
  types: [financialDecision, expense, investment, goal],
  agentHint:
    "Money capture — always extract the amount. A significant money choice to grade later (confidence + expected value) → financial-decision; everyday spending worth remembering (capture satisfaction if the user implies it) → expense; money put to work with a thesis (SIP, stock, fund, education, business) → investment; a savings target → goal. For investments: create ONE entry PER fund/asset (e.g. flexi cap and small cap are two investments), set frequency=monthly for a monthly SIP with amount = the monthly installment, and capture the thesis. A money *lesson* learned is a core `lesson` tagged money — not a money type. Keep follow-up questions minimal.",
};
