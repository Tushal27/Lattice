import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Architecture — Lattice" };

const LAYERS = [
  {
    icon: "🧠",
    name: "Memory",
    one: "Entries + a rolling summary + durable facts.",
    detail:
      "Everything you capture is one graph of typed entries. A server-side rolling memory and a set of durable facts about you are injected into every conversation, so context follows you across devices and threads — not trapped in one chat.",
  },
  {
    icon: "🔗",
    name: "Embeddings & recall",
    one: "Semantic search over your own history.",
    detail:
      "Entries are vector-embedded so recall is by meaning, not keywords. A model-aware similarity threshold with a lexical fallback means it degrades gracefully when embeddings aren't available — never silently wrong.",
  },
  {
    icon: "🕸️",
    name: "Knowledge graph",
    one: "Connections form themselves.",
    detail:
      "New entries auto-link to related ones by shared tags and meaning. The graph is the substrate that makes insights and the MistakeWarning possible — your past is queryable, not just stored.",
  },
  {
    icon: "✦",
    name: "Agent",
    one: "A provider-independent tool loop.",
    detail:
      "A strict-JSON tool protocol (create / update / connect / commit / schedule) runs the same across every model, with anti-hallucination guards and a capture safety-net. It's portable to a self-hosted model with zero rewrite.",
  },
  {
    icon: "💡",
    name: "Insight engine",
    one: "Proactivity, off the render path.",
    detail:
      "Throttled background passes compute triggers — decision-ready, repeated patterns, and a MistakeWarning that catches you about to repeat a logged lesson. Heavy work never blocks the UI.",
  },
  {
    icon: "📥",
    name: "Ingestion",
    one: "One path, many sources.",
    detail:
      "Files, web pages, and GitHub funnel through a single distill→entry→provenance→auto-link→audit pipeline. A Source table records where everything came from and dedupes, so nothing is ingested twice.",
  },
  {
    icon: "🤖",
    name: "Trust & autonomy",
    one: "Permissioned, audited action.",
    detail:
      "Each outward capability carries a trust level — off, ask, or auto. A durable job queue runs deferrable work with retries; a cron drives morning/evening presence. Every action is written to an append-only audit log.",
  },
];

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="🏗️"
        title="Architecture"
        subtitle="How Lattice is put together — and why it wasn't randomly assembled."
      />

      <p className="text-[15px] leading-relaxed text-zinc-300">
        Lattice is one brain with clean seams. Intelligence lives in libraries; surfaces just render. Everything degrades
        gracefully — no AI key, no embeddings, no integrations, and it still works. The pieces below compose into a single
        loop: <strong className="text-zinc-100">capture → connect → recall → act → learn</strong>.
      </p>

      <div className="space-y-3">
        {LAYERS.map((l, i) => (
          <div key={l.name} className="elev rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg">
                {l.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] tabular-nums text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="text-base font-semibold text-zinc-100">{l.name}</h2>
                </div>
                <p className="text-sm text-zinc-300">{l.one}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{l.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-sm leading-relaxed text-zinc-400">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Decisions worth noting</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>One database, two homes: libSQL speaks SQLite locally and Turso in production — schema is created idempotently on boot, so it deploys from a phone with no migration step.</li>
          <li>Provider-agnostic AI with an ordered fallback chain and streaming — it never hard-depends on one model vendor.</li>
          <li>Additive, reversible schema and trust-gated autonomy — new power never risks existing data.</li>
        </ul>
        <Link href="/vision" className="mt-3 inline-block font-medium text-violet-300 hover:underline">
          Read the vision →
        </Link>
      </div>
    </div>
  );
}
