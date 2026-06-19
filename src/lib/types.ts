// The shape of every captured area is described declaratively here. One config
// drives the capture form, the detail renderer, and validation — so adding a
// field (or a whole new area) is a data change, not a UI rewrite.

export type EntryType = "decision" | "lesson" | "aha" | "question" | "project";

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
  type: EntryType;
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

export const TYPES: Record<EntryType, TypeConfig> = {
  decision,
  lesson,
  aha,
  question,
  project,
};

export const TYPE_LIST: TypeConfig[] = [decision, lesson, aha, question, project];

export const SLUG_TO_TYPE: Record<string, EntryType> = Object.fromEntries(
  TYPE_LIST.map((t) => [t.slug, t.type]),
) as Record<string, EntryType>;

export function isEntryType(value: string): value is EntryType {
  return value in TYPES;
}

export function configFor(type: string): TypeConfig | undefined {
  return isEntryType(type) ? TYPES[type] : undefined;
}
