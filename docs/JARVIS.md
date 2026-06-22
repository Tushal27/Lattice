# Project Jarvis — Lattice as a Personal AI Operating System

This document is the living architecture and roadmap for evolving Lattice from a
*personal knowledge system* into a *personal AI operating system* — and toward a
true personal Jarvis. It is grounded in the current codebase, not aspiration.

The north star, in capabilities (not features):

> Jarvis **knows me**, **understands me**, **reaches me**, **acts for me**,
> **learns over time**, **exists across devices**, and **feels continuously present**.

---

## 1. Architecture audit (current state)

**Stack.** Next.js 16 (App Router, React 19, Turbopack), Prisma 7 + libSQL
adapter (local SQLite / Turso in prod), Tailwind v4, PWA. Schema is created
idempotently on boot via `ensureSchema.ts` (phone-only deploys, no migration
step). Single-user, single shared brain.

**Intelligence.** `src/lib/ai.ts` is a provider-agnostic engine with an ordered
fallback chain (custom roster → Groq → OpenRouter → Cerebras → Mistral →
Together → Gemini), multi-key rotation, and a two-pass retry. Everything
degrades gracefully to local heuristics when no key is reachable.
`src/lib/embeddings.ts` gives semantic recall (cosine over stored vectors,
model-aware thresholds, lexical fallback).

**Agent.** `src/lib/agent.ts` is a strict-JSON tool-protocol loop (provider
independent), bounded to a few steps, with read tools (search/get/list) and
write tools (create_entry, update_entry, connect_entries, create_commitment,
and now **create_calendar_event**). It has strong anti-hallucination guards
(capture-intent retry + safety net) and auto-links new entries by tag overlap.

**Proactivity.** `src/lib/insights.ts` computes triggers (review-ready,
forgotten questions, stalled projects, mistake warnings, money risks, …),
throttled and run off the render path. `src/app/api/cron/notify` (Vercel Cron)
recomputes and pushes via Web Push (`src/lib/push.ts`, VAPID-optional).

**Surfaces.** Dashboard (streamed via Suspense), Review, Commitments, Money OS,
Engineering OS, Graph, Reflections, persistent floating chat with rolling
memory, voice + image capture, PWA share-target, and a **Daily Brief**.

**Awareness & action (new).** Unified Google connection (`src/lib/google.ts`)
powering Gmail read (`src/lib/gmail.ts`) and Calendar read/write
(`src/lib/calendar.ts`); a **capability trust + audit layer**
(`src/lib/capabilities.ts`).

### Strengths
- Clean separation of intelligence (libs) from surfaces (routes/components).
- Provider-agnostic AI + tool protocol → portable to a self-hosted model.
- Everything optional degrades gracefully (no AI key, no VAPID, no Google).
- Streaming dashboard already keeps perceived latency low.

### Gaps (pre-Jarvis)
- **No outward awareness** — blind to calendar, email, files, web, GitHub.
- **No audit / permission model** — couldn't safely act autonomously.
- **No streaming for chat** — answers arrive all-at-once.
- **Memory is device-local** (localStorage) — not a server-side continuity store.
- **No event/queue model** — work is request- or cron-driven only.

---

## 2. Gap analysis vs. the seven capabilities

| Capability | Today | Gap |
|---|---|---|
| Knows me | Entries, embeddings, graph | Add external context (calendar, mail, files) ✅ started |
| Understands me | Wonder + judgment + insights | Server-side durable memory; better context assembly |
| Reaches me | Web Push digest | Brief-as-notification ✅; smarter, quieter targeting |
| Acts for me | In-app writes + calendar create ✅ | More tools (email draft, reschedule), confirm UX |
| Learns over time | Decision reviews, calibration | Feed outcomes of autonomous actions back into trust |
| Across devices | PWA | Server-side memory + sync; widgets |
| Continuously present | Daily/Evening brief ✅ | Streaming voice, ambient capture, proactive nudges |

---

## 3. Future-state architecture

```
            ┌────────────────────────── Surfaces ──────────────────────────┐
            │ Dashboard · Brief · Chat(stream) · Review · Settings · Widgets │
            └───────────────┬───────────────────────────┬──────────────────┘
                            │                           │
                   ┌────────▼─────────┐        ┌────────▼─────────┐
                   │  Agent / Tools   │        │  Insight engine  │
                   │ (JSON protocol)  │        │  (proactivity)   │
                   └───┬────────┬─────┘        └────────┬─────────┘
        ┌──────────────┘        │                       │
        │            ┌──────────▼───────────┐           │
        │            │ Capability layer     │  trust + audit (ActionLog)
        │            └──────────┬───────────┘           │
┌───────▼────────┐   ┌──────────▼───────────┐   ┌───────▼────────┐
│  Memory/RAG    │   │  Integrations        │   │  Events/Jobs   │
│ entries+embeds │   │ Google(Gmail,Cal),   │   │ cron → queue   │
│ +server memory │   │ GitHub, Files, Web   │   │ (future)       │
└───────┬────────┘   └──────────┬───────────┘   └───────┬────────┘
        └───────────────────────┴───────────────────────┘
                         Prisma / libSQL (Turso)
```

Key additions:
- **Capability layer** between the agent and the world: every outward action is
  trust-gated and audit-logged.
- **Integrations** as thin, uniform connectors over one OAuth core.
- **Events/Jobs**: today cron-driven; evolve to a lightweight queue (durable
  jobs table polled by cron / a worker) for ingestion and scheduled autonomy.
- **Server memory**: promote rolling chat memory and "facts about me" to a
  server table so continuity is cross-device.

---

## 4. Database changes

Added this phase (idempotent in `ensureSchema.ts`, mirrored in `schema.prisma`):

- `AppState(key, value, updatedAt)` — KV for OAuth tokens, sync cursors, and
  capability trust (`perm:<key>`).
- `ActionLog(id, capability, summary, status, source, entityId, createdAt)` —
  append-only audit trail.

Planned next:
- `Memory(id, kind, content, weight, updatedAt)` — durable server-side memory.
- `Job(id, kind, payload, runAt, status, attempts)` — background work queue.
- `Source(id, provider, externalId, type, raw, entryId)` — provenance for
  ingested items (email/file/web), enabling dedupe + "show original".

**Migration strategy.** All new tables are additive and created on boot; no
destructive changes. The earlier Gmail-only token (`gmail:token`) is read as a
fallback and superseded by the unified `google:token` — existing connections
keep working without re-auth where scopes already cover them.

---

## 5. Agent / tool architecture

The agent stays a **provider-independent JSON tool loop**. Tools are the unit of
action; adding a capability = adding a tool + (if outward) a capability spec.

- In-app tools (create/update/connect/commitment) act directly and are audited.
- **Outward tools** (calendar, future email) consult `getTrust(capability)`:
  - `off` → refuse with a clear message.
  - `ask` → propose (log as `proposed`), don't act, tell the user how to enable.
  - `auto` → act, then report; log as `done`/`failed`.
- Every successful write is written to `ActionLog`, surfaced in Settings.

This is the "Suggest + Confirm → Act + Report" dial, per capability, reversible.

---

## 6. Integration architecture

One OAuth core (`google.ts`) → many services. Each connector is read-first,
optional, and inert without credentials.

- **Gmail (read-only)** — scan recent inbox, AI-extract genuine action items →
  commitments (`gmail.capture`), deduped by message id.
- **Calendar (read/write)** — `upcomingEvents()` feeds the brief & dashboard;
  `createEvent()` backs the `create_calendar_event` tool (`calendar.create_event`).
- **Planned**: GitHub (repos/issues/PRs/commits → engineering insights),
  Files/PDF ingestion (→ knowledge), Browser capture (extends share-target),
  Calendar write-back of review blocks (autonomy).

Same shape every time: `*Enabled()`, `*Connected()`, read fn, optional write fn
gated by a capability.

---

## 7. Event-driven design

Today: request-driven + Vercel Cron (now **morning & evening**). The brief is
the notification — intelligence-driven, not spammy.

Next: a `Job` table as a minimal durable queue. Producers (ingestion, "act
later") enqueue; cron / a worker drains it. This decouples slow ingestion (email,
files) from requests and enables scheduled autonomy (e.g. "create the review
block at 9am") without blocking anything.

---

## 8. Security model

- Secrets only in env (`GOOGLE_CLIENT_*`, `AI_*`, `VAPID_*`, `CRON_SECRET`).
- OAuth refresh tokens live in the user's own Turso DB (single-user, single
  tenant). Read-only scopes by default (Gmail); Calendar limited to events.
- Cron protected by `CRON_SECRET` (bearer or query).
- Untrusted external text (email bodies, web content) is treated as data, never
  as instructions to the agent; extraction prompts are constrained to JSON.
- Auditability: every outward action is logged and user-visible.

---

## 9. Permission model

`capabilities.ts` defines governed capabilities; each has a `defaultTrust` and a
user override in `AppState` (`perm:<key>`). Levels: `off | ask | auto`. Outward
capabilities default to `ask`. The Settings page exposes the dial and the audit
feed. Trust is per-capability and instantly reversible.

---

## 10. Phased roadmap

- **Phase 0 — Foundation (DONE).** Daily Brief, share-target, Gmail capture.
- **Phase 1 — Awareness & Action (DONE).** Unified Google OAuth, Calendar
  read/write, capability **trust + audit** layer, `create_calendar_event` tool,
  Evening Brief, brief-as-push (morning + evening), Settings hub.
- **Phase 2 — Conversation (DONE).** ✅ **Streaming chat** (token-by-token
  Wonder via `streamText` + `/api/ai/stream`, full fallback chain, graceful
  degrade). ✅ **Server-side durable memory** (`memory.ts`, `/api/memory`,
  rolling memory authoritative + shared across devices, auto-migrated). ✅
  **Continuous voice** (`voice.ts` + hands-free loop in FloatingChat: listen →
  stream → speak → listen, with live state, barge-out, graceful no-support).
- **Phase 3 — Ingestion (IN PROGRESS).** ✅ `Source` provenance table + shared
  `ingestText()` path (distill → entry → provenance → auto-link → audit).
  ✅ **Files** (text/markdown, read client-side — no server parser deps).
  ✅ **Browser/web capture** (`/api/ingest/url` fetches + distills, deduped by
  URL). ✅ **GitHub** (read-only PAT → recent-activity snapshot distilled into an
  engineering note). ✅ **One-click web capture** (bookmarklet → same-origin
  `/ingest?url=`). PDF skipped by request. Remaining: `Job` queue for async
  ingestion; richer web extraction (readability, YouTube/oEmbed).
- **Phase 4 — Autonomy.** Auto-schedule review blocks, resurface forgotten work,
  spending-drift interventions — all trust-gated and audited.
- **Phase 5 — Presence everywhere.** Widgets, cross-device memory sync, smarter
  notification targeting.

---

## 11. Highest-ROI first steps

1. **Capability trust + audit layer** ✅ — unlocks safe autonomy for everything.
2. **Calendar read/write** ✅ — the single biggest "knows my world / acts" win.
3. **Evening brief + brief-as-push** ✅ — turns presence on.
4. **Streaming chat** ✅ — token-by-token answers, low time-to-first-token.
5. **Server memory** ✅ — cross-device continuity, authoritative rolling memory.
6. **Continuous voice** ✅ — hands-free listen → stream → speak → listen loop.
7. **Autonomy** (next) — trust-gated, audited proactive actions.

---

## 12. Technical risks

- **OAuth correctness** can't be end-to-end tested without the user's Google
  credentials; mitigated by mirroring the proven inert-without-creds pattern and
  verifying every disabled path.
- **Model variance** on tool JSON — mitigated by `jsonrepair`, guards, retries.
- **Autonomy trust** — mitigated by default `ask`, full audit, easy reversal.
- **Cron cost / limits** (Vercel Hobby) — two crons; brief generation is one
  model call each, with a deterministic fallback.
- **Single-user assumption** — fine today; multi-tenant would need per-user
  scoping of `AppState`/tokens.

---

## 13. Migration strategy

Additive only. New tables created on boot; no data rewrite. Token migration is
backward-compatible (`gmail:token` → `google:token`). Disabling any integration
or lowering trust is instant and non-destructive. Existing entries, embeddings,
commitments, and insights are untouched and immediately benefit from the new
awareness (e.g. the brief now folds in calendar).

---

## Setup required from the user (Google)

Gmail + Calendar are inert until you add OAuth credentials:

1. console.cloud.google.com → project → enable **Gmail API** + **Google
   Calendar API**.
2. OAuth consent screen → External → add yourself as a **Test user**.
3. Credentials → OAuth client ID → Web application → redirect URI
   `https://<domain>/api/google/callback` (and the localhost equivalent).
4. Set env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional
   `GOOGLE_REDIRECT_URI`). Redeploy → Settings → **Connect Google**.

Scopes: `gmail.readonly`, `calendar.events`, `calendar.readonly`. Lattice reads
your world and schedules within the permissions you set; it never sends or
deletes email.
