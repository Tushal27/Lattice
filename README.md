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

- **Knowledge connections** — link any two entries; Lattice also *suggests* links from shared tags and themes, so isolated notes become a network of understanding.
- **Global search** — recall anything across every area at once.
- **Life Timeline** — a chronological view of your evolution.
- **Reflections** — weekly and monthly reviews that turn recent activity into self-awareness.
- **Thinking Partner** — an AI that helps you *think better*: find patterns, connect ideas, and challenge assumptions, drawing on your own entries.

## Tech

- **Next.js 16** (App Router, React 19, TypeScript)
- **SQLite** via **Prisma 7** (driver-adapter / `better-sqlite3`) — local-first, no external database
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
| `npm run lint` | Lint |

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
    db.ts              Prisma client + sqlite adapter
prisma/                schema, migrations, seed
```
