# Lattice — Knowledge Transfer (Handbook)

A complete guide to what Lattice is, how to use every feature, and how it's
built. Skim the headings; dive where you need.

---

## 1. What Lattice is

A **personal operating system / second brain**. Not a notes app or task manager —
a place to capture *how you think* (decisions, lessons, breakthroughs, questions,
projects) so your knowledge **compounds over years** instead of being forgotten.

Core idea: **everything you capture is an "Entry."** Entries connect to each
other, get tagged, resurface over time, and an AI agent helps you capture,
connect, and reflect.

---

## 2. The five areas (Entry types)

| Area | Icon | Purpose | Key fields |
|---|---|---|---|
| **Decisions** | ⚖️ | Record a choice now, judge it later | context, options, reasoning, expected outcome, **confidence 0–100**, date, + later **review** (what happened / verdict / learning) |
| **Lessons** | 🎓 | Turn experience & mistakes into wisdom | category, what happened, root cause, the lesson, how to avoid repeating |
| **Aha Moments** | 💡 | Capture breakthroughs | what triggered it, the realization |
| **Curiosity Vault** (Questions) | ❓ | Never lose an interesting question | why it matters, status (open/exploring/answered), findings |
| **Projects** | 🚀 | Efforts that accumulate a story | goal, status (active/paused/done), reflections; other entries attach to it |

All five share one underlying model — adding a field or a new area is a config
change (`src/lib/types.ts`), not a rewrite.

---

## 3. Every screen (and how to use it)

### Dashboard (`/`)
Your home. Greeting + hero, **animated stat cards** per area (tap to open),
**Recent** entries, and a side rail with nudges: *Decisions ready to review*,
*Open questions*, and a Thinking-Partner shortcut.

### Capture (`/capture`, the ＋ button)
Two ways to capture:
1. **Quick Capture** — type or 🎤 speak a raw thought, tap **✨ Sort it for me**;
   AI picks the area and pre-fills title/summary/tags. Tweak and save.
2. **Pick an area** manually → a tailored form for that type.

### Area lists (`/decisions`, `/lessons`, `/aha`, `/questions`, `/projects`)
A grid of entry cards for that area, with a "New …" button.

### Entry detail (`/entry/[id]`)
Full view: all written fields, meta (confidence, status, date, parent project),
tags, a **review banner** for decisions old enough to judge, child entries (for
projects), and the **Connections panel** (existing links, suggested links, and
**✦ Ask AI why** they relate). Toolbar: **Edit** / **Delete**.

### Edit (`/entry/[id]/edit`)
Same form, pre-filled, including the **review** fields for decisions.

### Search (`/search`)
One box to recall anything across every area (title, summary, fields, tags).

### Life Timeline (`/timeline`)
Everything in chronological order, grouped by month — see your evolution.

### Daily Review (`/review`)
- **Decisions ready to judge** (old enough to review)
- **Worth remembering today** — older lessons/insights resurfaced on a daily rotation
- **On this day** — what you were thinking about on this date before

### Reflections (`/reflect`)
AI-written **weekly / monthly** reflection: what you learned, best decision,
biggest risk, a pattern, an open question. ↻ regenerate.

### Patterns (`/patterns`)
- Where your attention goes (area distribution)
- **Decision calibration** (avg confidence + reviewed verdicts)
- Recurring themes (tag cloud)
- Emerging interests (last 30 days)
- Your most-connected entries (hubs of thinking)

### Knowledge Graph (`/graph`)
Interactive force-directed map: nodes = entries (colored by type), edges =
connections + project membership. Drag, pinch/zoom (or +/− buttons), hover to
highlight a neighborhood, tap to open.

### Thinking Partner (`/companion`)
A full-page chat (the floating ✦ agent is the more capable everyday surface).

---

## 4. Global tools (available everywhere)

- **The Agent (✦, floating, bottom-right):** the star feature. Describe things
  in plain words and it *acts* — creates fully-filled entries, connects/updates
  them, answers questions about your data. Shows each action as a card with a
  link; never deletes. Voice 🎤 supported.
- **Command Palette (⌘K, or "Find" on mobile):** instant capture, search, and
  navigation.
- **Voice dictation (🎤):** tap-and-talk in the agent chat and Quick Capture.
- **Toasts:** confirmation feedback for actions.
- **Mobile-first chrome:** bottom tab bar + center capture button; installable
  PWA (home-screen icon, offline for visited pages).

See `README.md` → *Enabling AI* and below for the AI details.

---

## 5. The AI (engine + features)

**Engine** (`src/lib/ai.ts`): one provider-agnostic layer with a **fallback
chain**. Configure any keys; it tries them in order until one answers.
- Providers: `custom → Groq → OpenRouter → Cerebras → Mistral → Together → Gemini`
- Multiple keys per provider (comma-separated) to dodge rate limits
- `AI_PROVIDER_ORDER` to reorder, `AI_PROVIDER` to pin one
- **Your own model:** set `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` → becomes primary
- No keys → features fall back to local heuristics (app stays usable)

**AI-powered features:**
1. **Agent** (`/api/agent`) — tool-using assistant: create/update/connect/search/
   read entries via a bounded, delete-free loop and a provider-agnostic JSON
   protocol.
2. **Quick Capture classify** (`/api/ai` task `classify`) — raw thought → area +
   fields. Heuristic fallback offline.
3. **Reflections** (`task reflect`) — weekly/monthly summary. Templated fallback.
4. **Connection insight** (`task connect`) — why suggested entries relate.
   Tag/keyword suggestions work without AI.
5. **Voice → text** — browser Web Speech API (on-device, free).

**Privacy:** context is sent to whichever provider you configure (over HTTPS).
With no keys, nothing leaves the app. The custom-roster option keeps data on
your own infra.

---

## 6. Architecture

- **Framework:** Next.js 16 (App Router, React 19, TypeScript), Turbopack.
- **Styling:** Tailwind CSS v4 + `motion` for animation. Dark, glass, aurora.
- **DB:** SQLite via **Prisma 7** + the **libSQL** driver adapter. Same code for
  a local file (`dev.db`) and hosted **Turso** in production — switched by env.
- **PWA:** web manifest + service worker (`public/sw.js`) + icons; offline
  fallback page; standalone display.
- **Auto-migration:** `src/instrumentation.ts` runs `ensureSchema()` once at
  server start, creating tables if missing — so a fresh/empty production DB just
  works (no migration step needed to deploy).

**Data model (`prisma/schema.prisma`):**
- `Entry` — `id, type, title, summary, status, confidence, fields (JSON),
  occurredAt, createdAt, updatedAt, projectId (self-relation)`
- `Tag` + `EntryTag` (many-to-many)
- `Connection` — undirected link between two entries (`fromId, toId, note`)

**How data flows:**
- **Reads:** Server Components call helpers in `src/lib/entries.ts` (Prisma)
  directly. Pages are `dynamic` so they're always fresh.
- **Writes:** client components call **API route handlers**
  (`/api/entries`, `/api/connections`, `/api/agent`, `/api/ai`, `/api/search`),
  then `router.refresh()` to re-render server data.
- **Config-driven UI:** `src/lib/types.ts` describes each area's fields; one
  form (`EntryForm`) and one detail renderer handle all types.

---

## 7. Project structure

```
src/
  app/
    page.tsx              dashboard
    capture/              quick capture + manual picker
    decisions|lessons|aha|questions|projects/   area lists
    entry/[id]/           detail + /edit
    search/ timeline/ review/ reflect/ patterns/ graph/ companion/
    offline/              PWA offline fallback
    layout.tsx template.tsx loading.tsx not-found.tsx
    manifest.ts icon.svg
    api/
      entries/ entries/[id]/ connections/ search/   CRUD
      ai/        reflect | connect | ask | classify
      agent/     the tool-using agent
  components/             Sidebar, MobileNav, CommandPalette, FloatingChat,
                         MicButton, EntryForm, EntryCard, QuickCapture,
                         StatGrid, GraphCanvas, Toast, Markdown, ui, entry/*
  lib/
    types.ts     area/field config (drives forms + detail)
    entries.ts   data access, tags, search, suggestions, stats, resurfacing
    ai.ts        provider engine + fallback chain
    agent.ts     agentic tool loop
    companion.ts AI orchestration (reflect/connect/classify/ask)
    db.ts        Prisma client + libSQL adapter
    ensureSchema.ts  idempotent table creation
    utils.ts     formatting, accents, helpers
  instrumentation.ts      runs ensureSchema on boot
prisma/          schema, migrations, seed
scripts/         migrate-turso.mjs
public/          icons + sw.js
```

---

## 8. Running & deploying

**Local:**
```bash
npm install        # also runs prisma generate
npm run db:setup   # create dev.db
npm run db:seed    # sample data (optional)
npm run dev        # http://localhost:3000
```

**Deploy (phone-friendly):**
1. Create a free **Turso** DB (turso.tech) → copy URL + create a token.
2. **Vercel** → import the repo → set env vars:
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and an AI key
   (`GROQ_API_KEY` recommended). → Deploy.
3. Open the URL on your phone → **Add to Home Screen**.
Schema is created automatically on first boot. Every push to `main` redeploys.

**Scripts:** `dev`, `build`, `start`, `lint`, `db:setup`, `db:seed`,
`db:reset`, `db:turso` (apply schema to Turso), `postinstall` (prisma generate).

---

## 9. A typical day with Lattice

1. **Capture in the moment** — tap ✦, speak or type: *"decided to … , confident,
   tag …"*; the agent files it.
2. **Morning: Daily Review** — judge a ripe decision, revisit a resurfaced lesson.
3. **Connect** — on an entry, link related ideas (or let the agent do it).
4. **Weekly: Reflect** — read the AI reflection; note patterns.
5. **Explore** — Graph and Patterns show how your thinking is shaped.
6. **Search** — recall anything, anytime.

The point: every lesson, decision, and question becomes more valuable over time.
