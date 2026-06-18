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

**Mobile-first & installable (PWA).** Lattice is built to live on your phone: a thumb-reachable bottom tab bar, a central capture button, touch-friendly graph gestures, and responsive layouts throughout. It's an installable Progressive Web App with a home-screen icon, standalone (no browser chrome) display, app shortcuts, and a service worker that keeps pages you've already opened available offline.

To install: open the deployed URL on your phone → browser menu → **Add to Home Screen**. On desktop Chrome, use the install icon in the address bar.

## Tech

- **Next.js 16** (App Router, React 19, TypeScript)
- **SQLite / libSQL** via **Prisma 7** (libSQL driver adapter) — a local file in development, a hosted **Turso** database in production, with the exact same code path
- **Tailwind CSS v4**
- **Gemini** for the AI features, called over plain HTTP with a graceful local fallback

The data model is deliberately simple: one `Entry` table with a `type` discriminator and a JSON `fields` column for type-specific data, plus relational `Tag`s and undirected `Connection`s. Adding a field — or a whole new area — is a config change in `src/lib/types.ts`, not a UI rewrite.

## Getting started

```bash
npm install            # also generates the Prisma client (postinstall)
cp .env.example .env   # optional — defaults work without it
npm run db:setup       # apply migrations / create the database
npm run db:seed        # optional — load sample entries so the UI looks alive
npm run dev            # http://localhost:3000
```

### Enabling AI

The app is fully usable without AI. To turn on the thinking partner, reflections, and connection insight, add a free [Google AI Studio](https://aistudio.google.com/apikey) key to `.env`:

```bash
GEMINI_API_KEY="your-key-here"
```

Until then, those features fall back to local heuristics (tag/keyword-based suggestions and templated reflections).

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
   - `GEMINI_API_KEY` (optional, for AI features)

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
    ai.ts              Gemini REST client
    db.ts              Prisma client + libSQL adapter (local file or Turso)
prisma/                schema, migrations, seed
scripts/               migrate-turso.mjs (apply schema to a hosted Turso db)
public/                PWA manifest icons + service worker (sw.js)
```
