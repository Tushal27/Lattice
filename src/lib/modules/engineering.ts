// Engineering OS — the first domain module built on the Lattice core.
// It contributes its own entry types; capture, the agent, connections, the graph,
// reminders, embeddings and insights all work on them automatically because the
// core operates on generic entries. Only TypeConfig (a type) is imported, so this
// file has no runtime dependency back on the registry.

import type { ModuleConfig, TypeConfig } from "@/lib/types";

const incident: TypeConfig = {
  type: "incident",
  label: "Incident",
  plural: "Incidents",
  slug: "incidents",
  icon: "🔥",
  accent: "rose",
  tagline: "Outages and breakages — capture, resolve, learn.",
  intro: "What broke, how bad, and how you brought it back. The postmortem starts here.",
  fields: [
    { key: "title", label: "What happened", kind: "text", column: true, placeholder: "API 500s spiking after deploy" },
    { key: "severity", label: "Severity", kind: "select", column: false, options: ["", "SEV1", "SEV2", "SEV3", "minor"] },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "impact", label: "Impact", kind: "textarea", placeholder: "Who/what was affected, for how long" },
    { key: "rootCause", label: "Root cause", kind: "textarea", placeholder: "What actually caused it" },
    { key: "resolution", label: "Resolution", kind: "textarea", placeholder: "How it was fixed / mitigated" },
    { key: "prevention", label: "Prevention / follow-ups", kind: "textarea", placeholder: "What stops a repeat" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "Timeline, logs, the full story." },
    { key: "occurredAt", label: "When", kind: "date", column: true },
  ],
};

const architecture: TypeConfig = {
  type: "architecture",
  label: "Architecture Decision",
  plural: "Architecture",
  slug: "architecture",
  icon: "🏛️",
  accent: "cyan",
  tagline: "ADRs — decisions about how the system is built.",
  intro: "Record a technical decision (an ADR) so the 'why' survives long after the code.",
  fields: [
    { key: "title", label: "The decision", kind: "text", column: true, placeholder: "Use libSQL/Turso for persistence" },
    { key: "status", label: "Status", kind: "select", column: true, options: ["proposed", "accepted", "superseded"] },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "context", label: "Context / forces", kind: "textarea", placeholder: "Constraints and pressures driving this" },
    { key: "decision", label: "Decision", kind: "textarea", placeholder: "What you're choosing to do" },
    { key: "alternatives", label: "Alternatives considered", kind: "textarea" },
    { key: "consequences", label: "Consequences / trade-offs", kind: "textarea" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "The full story — nothing gets trimmed." },
    { key: "occurredAt", label: "Date decided", kind: "date", column: true },
  ],
};

const bug: TypeConfig = {
  type: "bug",
  label: "Debug Log",
  plural: "Debug Logs",
  slug: "bugs",
  icon: "🪲",
  accent: "orange",
  tagline: "Tricky bugs and how you cracked them.",
  intro: "Capture a gnarly bug and its fix so you never lose the hours twice.",
  fields: [
    { key: "title", label: "The bug", kind: "text", column: true, placeholder: "Hydration mismatch on the graph page" },
    { key: "summary", label: "One-line summary", kind: "text", column: true },
    { key: "symptom", label: "Symptom", kind: "textarea", placeholder: "What you observed" },
    { key: "cause", label: "Cause", kind: "textarea", placeholder: "What was actually wrong" },
    { key: "fix", label: "Fix", kind: "textarea", placeholder: "What resolved it" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "Stack traces, repro, the full story." },
    { key: "occurredAt", label: "When", kind: "date", column: true },
  ],
};

const snippet: TypeConfig = {
  type: "snippet",
  label: "Pattern",
  plural: "Patterns & Snippets",
  slug: "snippets",
  icon: "🧩",
  accent: "lime",
  tagline: "Reusable solutions worth keeping.",
  intro: "A pattern, snippet, or technique you'll want to reach for again.",
  fields: [
    { key: "title", label: "Name", kind: "text", column: true, placeholder: "Optimistic UI with rollback" },
    { key: "summary", label: "What it's for", kind: "text", column: true },
    { key: "problem", label: "Problem it solves", kind: "textarea" },
    { key: "solution", label: "The approach", kind: "textarea" },
    { key: "code", label: "Code / example", kind: "textarea", placeholder: "Paste the snippet" },
    { key: "details", label: "Details", kind: "textarea", placeholder: "Caveats, links, the full story." },
  ],
};

export const engineeringModule: ModuleConfig = {
  id: "engineering",
  name: "Engineering OS",
  icon: "🛠️",
  accent: "cyan",
  tagline: "Incidents, ADRs, bugs, and patterns — your engineering memory.",
  types: [incident, architecture, bug, snippet],
  agentHint:
    "Engineering capture: an outage/breakage → incident; a technical/system decision (ADR) → architecture; a debugged problem and its fix → bug; a reusable technique/snippet → snippet.",
};
