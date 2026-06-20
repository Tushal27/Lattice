// The shape of every captured area is described declaratively here. One config
// drives the capture form, the detail renderer, the agent schema, and validation
// — so adding a field, a whole new area, or an entire MODULE (Engineering, Health,
// …) is a data change, not a UI rewrite. The five core types below are the
// built-in "Personal" module; other modules contribute their own types and the
// rest of the app picks them up automatically.

// Entry-type keys are dynamic now (modules add their own), so this is a string
// alias rather than a fixed union — runtime guards (isEntryType) keep it honest.
import { engineeringModule } from "@/lib/modules/engineering";

export type EntryType = string;

export type FieldKind = "text" | "textarea" | "select" | "number" | "date";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** When true the value maps to a real Entry column; otherwise it lives in the `fields` JSON. */
  column?: boolean;
  placeholder?: string;
  options?: string[];
  help?: string;
  /** Fields shown only when reviewing an entry later (e.g. how a decision turned out). */
  review?: boolean;
}

export interface TypeConfig {
  type: string;
  label: string;
  plural: string;
  slug: string;
  icon: string;
  /** Tailwind color family used for accents (text-{accent}-400, bg-{accent}-500/10, ...). */
  accent: string;
  tagline: string;
  /** Prompt shown above the capture form. */
  intro: string;
  fields: FieldDef[];
}

const decision: TypeConfig = {
  type: "decision",
  label: "Decision",
  plural: "Decisions",
  slug: "decisions",
  icon: "⚖️",
  accent: "amber",
  tagline: "Record choices now, judge them later.",
  intro: "Capture the thinking behind an important choice so future-you can grade the call.",
  fields: [
    { key: "title", label: "The decision", kind: "text", column: true, placeholder: "Take the new job at..." },
    { key: "summary", label: "One-line summary", kind: "text", column: true, placeholder: "Why, in a sentence" },
    { key: "context", label: "Context", kind: "textarea", placeholder: "What's the situation forcing this decision?" },
    { key: "options", label: "Options considered", kind: "textarea", placeholder: "Alternatives you weighed" },
    { key: "reasoning", label: "Reasoning", kind: "textarea", placeholder: "Why this choice over the others" },
    { key: "expected", label: "Expected outcome", kind: "textarea", placeholder: "What you think will happen" },
    { key: "confidence", label: "Confidence (0–100)", kind: "number", column: true, help: "How sure are you, right now?" },
    { key: "occurredAt", label: "Date decided", kind: "date", column: true },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "reviewOutcome", label: "What actually happened", kind: "textarea", review: true, placeholder: "Review later" },
    { key: "reviewVerdict", label: "Was it the right call?", kind: "select", review: true, options: ["", "Right call", "Mixed", "Wrong call", "Too early to tell"] },
    { key: "wouldRepeat", label: "Would you decide the same again?", kind: "select", review: true, options: ["", "Yes", "No", "Not sure"] },
    { key: "reviewLearning", label: "What you'd do differently", kind: "textarea", review: true },
  ],
};

const lesson: TypeConfig = {
  type: "lesson",
  label: "Lesson",
  plural: "Lessons",
  slug: "lessons",
  icon: "🎓",
  accent: "emerald",
  tagline: "Turn mistakes into a personal wisdom library.",
  intro: "Distill an experience into something you can apply next time.",
  fields: [
    { key: "title", label: "The lesson (one sentence)", kind: "text", column: true, placeholder: "Always confirm the backup before deleting" },
    { key: "category", label: "Area", kind: "select", column: false, options: ["Technical", "Business", "Life", "Communication", "Health", "Other"] },
    { key: "summary", label: "Short summary", kind: "text", column: true },
    { key: "whatHappened", label: "What happened", kind: "textarea", placeholder: "The situation that taught you this" },
    { key: "rootCause", label: "Root cause", kind: "textarea", placeholder: "Why it really happened" },
    { key: "lesson", label: "What you learned", kind: "textarea" },
    { key: "prevention", label: "How to avoid repeating it", kind: "textarea" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "occurredAt", label: "When", kind: "date", column: true },
  ],
};

const aha: TypeConfig = {
  type: "aha",
  label: "Aha Moment",
  plural: "Aha Moments",
  slug: "aha",
  icon: "💡",
  accent: "fuchsia",
  tagline: "Collect your breakthroughs.",
  intro: "A moment of deep understanding — a connection clicking into place.",
  fields: [
    { key: "title", label: "The insight", kind: "text", column: true, placeholder: "Marketplaces win by owning the supply side" },
    { key: "summary", label: "In a sentence", kind: "text", column: true },
    { key: "trigger", label: "What triggered it", kind: "textarea", placeholder: "What were you doing or reading?" },
    { key: "detail", label: "Explain the realization", kind: "textarea" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "occurredAt", label: "When", kind: "date", column: true },
  ],
};

const question: TypeConfig = {
  type: "question",
  label: "Question",
  plural: "Curiosity Vault",
  slug: "questions",
  icon: "❓",
  accent: "sky",
  tagline: "Never lose an interesting question.",
  intro: "Capture a question instantly. It can grow into research, a project, or a lesson.",
  fields: [
    { key: "title", label: "Your question", kind: "text", column: true, placeholder: "How do game economies stay balanced?" },
    { key: "status", label: "Status", kind: "select", column: true, options: ["open", "exploring", "answered"] },
    { key: "why", label: "Why it matters", kind: "textarea", placeholder: "What sparked it / why you care" },
    { key: "answer", label: "Findings", kind: "textarea", placeholder: "Add what you learn as you go" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
  ],
};

const project: TypeConfig = {
  type: "project",
  label: "Project",
  plural: "Projects",
  slug: "projects",
  icon: "🚀",
  accent: "violet",
  tagline: "Every project becomes a story, not a task list.",
  intro: "A meaningful effort that accumulates decisions, lessons, and milestones over time.",
  fields: [
    { key: "title", label: "Project name", kind: "text", column: true, placeholder: "Lattice" },
    { key: "status", label: "Status", kind: "select", column: true, options: ["active", "paused", "done"] },
    { key: "summary", label: "What is it?", kind: "text", column: true },
    { key: "goal", label: "Goal / definition of done", kind: "textarea" },
    { key: "reflection", label: "Reflections", kind: "textarea", placeholder: "How it's going, what you're noticing" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "occurredAt", label: "Started", kind: "date", column: true },
  ],
};

// ---- modules ---------------------------------------------------------------

export interface ModuleConfig {
  id: string; // "core" | "engineering" | …
  name: string;
  icon: string;
  accent: string;
  tagline: string;
  types: TypeConfig[];
  /** Extra guidance appended to the agent's system prompt. */
  agentHint?: string;
}

// The built-in personal module — Lattice as you've used it so far.
export const coreModule: ModuleConfig = {
  id: "core",
  name: "Personal",
  icon: "🧠",
  accent: "violet",
  tagline: "Decisions, lessons, breakthroughs, questions, and projects.",
  types: [decision, lesson, aha, question, project],
};

// Registered modules. Adding one here lights it up everywhere — one shared brain.
export const MODULES: ModuleConfig[] = [coreModule, engineeringModule];

export const TYPE_LIST: TypeConfig[] = MODULES.flatMap((m) => m.types);

export const TYPES: Record<string, TypeConfig> = Object.fromEntries(TYPE_LIST.map((t) => [t.type, t]));

export const SLUG_TO_TYPE: Record<string, string> = Object.fromEntries(TYPE_LIST.map((t) => [t.slug, t.type]));

// type-key → owning module, for scoping views to a module.
const TYPE_TO_MODULE: Record<string, ModuleConfig> = Object.fromEntries(
  MODULES.flatMap((m) => m.types.map((t) => [t.type, m])),
);

export function isEntryType(value: string): value is EntryType {
  return value in TYPES;
}

export function configFor(type: string): TypeConfig | undefined {
  return TYPES[type];
}

export function moduleForType(type: string): ModuleConfig | undefined {
  return TYPE_TO_MODULE[type];
}

export function moduleById(id: string): ModuleConfig | undefined {
  return MODULES.find((m) => m.id === id);
}

/** Type configs belonging to a module id, or all types for "all"/unknown. */
export function typesForModule(id: string | null | undefined): TypeConfig[] {
  if (!id || id === "all") return TYPE_LIST;
  return moduleById(id)?.types ?? TYPE_LIST;
}
