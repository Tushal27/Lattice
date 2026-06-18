# Lattice

**A personal operating system — a second brain where your knowledge, decisions, and insights compound over years.**

Lattice isn't a note-taking app or a task manager. It's a place to capture *how you think*: the decisions you make, the lessons you learn, the moments things click, the questions you can't stop asking, and the projects that carry them. Over time it becomes a map of how you became who you are.

## What's inside

Every captured moment is an **Entry**. There are five kinds:

| Area | Icon | What it's for |
| --- | --- | --- |
| **Decisions** | ⚖️ | Record a choice with its context, reasoning and confidence — then review later whether it was right. |
| **Lessons** | 🎓 | Turn experiences (and mistakes) into a personal wisdom library. |
| **Aha Moments** | 💡 | Collect breakthroughs — the moments understanding clicks into place. |
| **Curiosity Vault** | ❓ | Capture questions instantly so nothing interesting is ever lost. |
| **Projects** | 🚀 | Meaningful efforts that accumulate decisions, lessons and milestones into a story. |

On top of the areas:

- **Quick Capture** — dump a raw thought and AI sorts it into the right area with a title and tags. Friction is the #1 reason second brains get abandoned.
- **⌘K Command Palette** — capture, search, and jump anywhere from one keystroke (or the "Find" button on mobile).
- **Knowledge Graph** — an interactive, force-directed visualization of your lattice: nodes are entries, edges are connections and project membership. Drag, zoom, and click through.
- **Daily Review** — decisions old enough to judge, spaced resurfacing of past lessons, and "on this day" — so nothing valuable stays buried.
- **Patterns** — where your attention goes, recurring themes, emerging interests, decision calibration (confidence vs outcome), and your most-connected ideas.
- **Knowledge connections** — link any two entries; Lattice also *suggests* links from shared tags and themes.
- **Global search** — recall anything across every area at once.
- **Life Timeline** — a chronological view of your evolution.
- **Reflections** — weekly and monthly reviews that turn recent activity into self-awareness.
- **Thinking Partner** — an AI that helps you *think better*: find patterns, connect ideas, and challenge assumptions, drawing on your own entries.
- **Agent** — the floating ✦ assistant doesn't just talk, it *acts*. Say "I decided to drop the side project, fairly sure, tag career" and it creates a fully-filled Decision; ask it to connect, update, or mark a question answered and it does, showing each action as a card you can open or undo. Uses a provider-agnostic JSON tool protocol over a bounded, delete-free loop.

**Mobile-first & installable (PWA).** Lattice is built to live on your phone: a thumb-reachable bottom tab bar, a central capture button, touch-friendly graph gestures, and responsive layouts throughout. It's an installable Progressive Web App with a home-screen icon, standalone (no browser chrome) display, app shortcuts, and a service worker that keeps pages you've already opened available offline.

To install: open the deployed URL on your phone → browser menu → **Add to Home Screen**. On desktop Chrome, use the install icon in the address bar.

## Tech

- **Next.js 16** (App Router, React 19, TypeScript)
- **SQLite / libSQL** via **Prisma 7** (libSQL driver adapter) — a local file in development, a hosted **Turso** database in production, with the exact same code path
- **Tailwind CSS v4**
- **Pluggable AI** (Groq / OpenRouter / Gemini) over plain HTTP, with a graceful local fallback

The data model is deliberately simple: one `Entry` table with a `type` discriminator and a JSON `fields` column for type-specific data, plus relational `Tag`s and undirected `Connection`s. Adding a field — or a whole new area — is a config change in `src/lib/types.ts`, not a UI rewrite.

## Getting started

```bash
npm install            # also generates the Prisma client (postinstall)
cp .env.example .env   # optional — defaults work without it
npm run db:setup       # apply migrations / create the database
npm run db:seed        # optional — load sample entries so the UI looks alive
npm run dev            # http://localhost:3000
```

### Enabling AI (fallback engine)

The app is fully usable without AI. To turn on the thinking partner, reflections, quick-capture sorting, and connection insight, add **one or more** provider keys to `.env`. The AI engine tries them **in order until one answers**, so a rate-limited (HTTP 429) or down provider falls through to the next automatically — your app stays up even when a provider is flaky.

```bash
GROQ_API_KEY="..."        # recommended: fast + generous free tier (console.groq.com/keys)
OPENROUTER_API_KEY="..."  # many models incl. free ones (openrouter.ai/keys)
CEREBRAS_API_KEY="..."    # very fast free tier (cloud.cerebras.ai)
MISTRAL_API_KEY="..."     # free tier (console.mistral.ai)
TOGETHER_API_KEY="..."    # free + paid (api.together.ai)
GEMINI_API_KEY="..."      # free tier 429s easily (aistudio.google.com/apikey)
```

Default try order is **custom → Groq → OpenRouter → Cerebras → Mistral → Together → Gemini**. Customize with `AI_PROVIDER_ORDER="mistral,groq,gemini"`, or pin one with `AI_PROVIDER=groq`.

**Bring your own model:** point Lattice at any OpenAI-compatible endpoint (e.g. a self-hosted roster) by setting `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` — it then becomes the primary engine, with the public providers as automatic fallback.

> **Dodge rate limits:** give one provider several comma-separated keys and the engine rotates through them — `GROQ_API_KEY="key_one,key_two"`.

Until at least one key is set, these features fall back to local heuristics (tag/keyword-based suggestions and templated reflections).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run db:setup` | Apply migrations (creates `dev.db`) |
| `npm run db:seed` | Load sample data |
| `npm run db:reset` | Drop and recreate the database |
| `npm run db:turso` | Apply the schema to a hosted Turso database |
| `npm run lint` | Lint |

## Deploy (doable entirely from a phone browser)

A PWA installs from a hosted URL, and serverless hosts have an ephemeral
filesystem — so production uses a hosted **Turso** (libSQL) database instead of
a local file. Nothing in the app code changes; it's all environment variables.
**The app creates its own tables on first boot, so there is no migration step.**

1. **Create a Turso database** at [turso.tech](https://turso.tech) (free). From
   the web dashboard (works on mobile), copy the database **URL**
   (`libsql://…`) and create an **auth token**. With the CLI it's instead:
   ```bash
   turso db create lattice
   turso db show lattice --url       # -> TURSO_DATABASE_URL
   turso db tokens create lattice    # -> TURSO_AUTH_TOKEN
   ```

2. **Deploy to Vercel** (or any Next.js host): import the repo and set these
   environment variables in the project settings:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - one AI key (optional): `GROQ_API_KEY` *(recommended)*, `OPENROUTER_API_KEY`, or `GEMINI_API_KEY`

   The build runs `prisma generate` via `postinstall`; no database is touched at
   build time, and the schema is applied automatically on first run.

3. **Install on your phone**: open the deployed URL → **Add to Home Screen**.

> When `TURSO_DATABASE_URL` is set, the app uses it; otherwise it falls back to
> the local `DATABASE_URL` file. The same libSQL adapter handles both. If you'd
> rather apply the schema manually, `npm run db:turso` still works.

## Project structure

```
src/
  app/                 routes (dashboard, areas, capture, entry, search, timeline, reflect, companion)
    api/               route handlers — entries CRUD, connections, AI
  components/          UI: sidebar, cards, forms, connection panel, markdown
  lib/
    types.ts           config that drives every area's form & detail view
    entries.ts         data access, tags, search, connection suggestions
    companion.ts       AI orchestration (reflection, connect, ask) with fallbacks
    ai.ts              pluggable AI client (Groq / OpenRouter / Gemini)
    db.ts              Prisma client + libSQL adapter (local file or Turso)
prisma/                schema, migrations, seed
scripts/               migrate-turso.mjs (apply schema to a hosted Turso db)
public/                PWA manifest icons + service worker (sw.js)
```
