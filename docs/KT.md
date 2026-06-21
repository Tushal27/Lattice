# Lattice — Knowledge Transfer (Handbook)

A complete guide to what Lattice is, how to use every feature, and how it's
built. Skim the headings; dive where you need.

---

## 1. What Lattice is

A **personal operating system / second brain**. Not a notes or task app — a place
to capture *how you think* (decisions, lessons, breakthroughs, questions,
projects) so your knowledge **compounds over years**. Everything you capture is
an **Entry**; entries connect, get tagged, resurface over time, and an AI helps
you capture, connect, reflect, and learn.

Mobile-first and installable (PWA). Local-first data (SQLite) that scales to a
hosted database (Turso) with no code change.

---

## 2. The five areas (Entry types)

| Area | Icon | Purpose | Notable fields |
|---|---|---|---|
| **Decisions** | ⚖️ | Record a choice now, judge it later | context, options, reasoning, expected outcome, **confidence 0–100**, date, **Details**, + review: actual outcome, verdict, would-repeat, learning |
| **Lessons** | 🎓 | Turn mistakes into wisdom | category, what happened, root cause, lesson, prevention, Details |
| **Aha Moments** | 💡 | Capture breakthroughs | trigger, the realization, Details |
| **Curiosity Vault** (Questions) | ❓ | Never lose a question | why it matters, status (open/exploring/answered), findings, Details |
| **Projects** | 🚀 | Efforts that accumulate a story | goal, status, reflections, Details; other entries attach to them |

Every type has a **Details** catch-all so nothing you write (or paste, or
photograph) gets trimmed. The whole system is config-driven in
`src/lib/types.ts` — one form and one detail view serve all areas.

---

## 2b. Modules (Lattice core + OS packs)

Lattice is a **core engine** (capture, AI agent, connections, graph, search,
reminders, semantic memory, insights) that operates on generic entries. A
**module** is just a pack of config that plugs in its own entry types — and
everything above works on them for free. It's **one shared brain**: modules
cross-connect, and the graph/search/insights span all of them.

- **Personal** (built-in): the five core areas above.
- **Engineering OS**: `incident` (🔥), `architecture`/ADR (🏛️), `bug`/debug log
  (🪲), `snippet`/pattern (🧩) — plus engineering insights (an ADR stuck in
  "proposed", an incident with no prevention follow-up).
- **Money OS**: optimizes for *financial judgment*, not bookkeeping. Types:
  `financial-decision` (🏦, reviewable), `expense` (🧾, with a satisfaction
  signal), `investment` (📈, reviewable), `goal` (🪙). Money *lessons* are core
  Lessons tagged #money. The **`/money` Money Review** answers "did spending
  improve my life?":
  - **Quick-spend** — log an expense (what · amount · worth-it?) in seconds, or
    just say it to ✦ ("spent ₹500 on lunch, meh").
  - **AI Money Reflection** — best money, most regretted, where money buys the
    most life, a belief proven right/wrong, a lesson, one change (per
    month/quarter/year; local fallback without a key).
  - **Headline stats** — remembered spend, invested, goals, awaiting review.
  - **Best vs most-regretted**, **ROI by category**, and **Goals with one-tap
    contributions** (＋ add, or 🔔 set a monthly contribution commitment).
  - **Insights**: regret patterns, subscription waste, positive-ROI categories,
    spending drift, goal drift.
  - Financial decisions & investments flow through the same review +
    judgment-calibration engine as decisions. Currency via `LATTICE_CURRENCY`
    /`LATTICE_LOCALE` (default ₹ / en-IN).

The **dashboard module switcher** (All / Personal / Engineering …) scopes the
stats and recent list to one lens without siloing data. Area lists live at
`/area/<slug>`. Adding a new module is a single config file in
`src/lib/modules/` registered in `src/lib/types.ts` — no UI rewrite.

---

## 3. Capturing (five ways)

1. **The Agent (✦) — Capture mode:** say it in plain words and it files the
   right entry, fully filled, preserving your full text. Then it **auto-links**
   the new entry to related ones.
2. **Quick Capture** (`/capture` → "✨ Sort it for me"): dump a raw thought, AI
   picks the area + fills title/summary/tags; you tweak and save.
3. **Manual**: pick an area for a tailored form.
4. **Voice (🎤)**: tap-and-talk dictation in the chat and Quick Capture.
5. **Snap & Capture (📷)**: photograph handwritten notes, a whiteboard, a
   screenshot, or a book page — the **vision** AI reads it and files the entry.
   Images are compressed on-device first to stay token-cheap.

---

## 4. The AI chat (✦) — two brains in one

A floating ✦ button (draggable; tap to open) opens a **full-screen** chat with a
mode toggle:

- **🧠 Wonder** — the thinking partner. Conversational, remembers the thread,
  draws on your entries, and **never auto-saves**. When a conversation reaches
  something worth keeping, tap **"✦ Save this as an entry."**
- **✦ Capture** — the agent. Say it → it files it instantly (create / update /
  connect), shows **action cards** with open links, and updates your data live.
  Never deletes.

Both modes accept **voice** and **images**, and the header shows the live
provider (e.g. "connected · custom"). Input is a paste-friendly auto-growing box
(Enter sends on desktop; on phones Enter = newline, ↑ sends).

---

## 5. Decision Review (improve your judgment)

- Decisions become **"ready to judge" after 14 days** (Daily Review + dashboard).
- Record the **actual outcome**, a **verdict** (Right call / Mixed / Wrong call /
  Too early), **would you decide the same again?**, and what you'd do
  differently. A **reviewedAt** timestamp is stamped automatically.
- The entry shows **Expected vs Actual** side-by-side with a colored verdict
  badge.
- You can review by voice/text too: *"review my X decision — it worked out,
  right call, I'd do it again."*
- **AI Judgment analysis** (Patterns) studies your reviewed decisions for
  **confidence calibration** and what your right vs wrong calls have in common.

---

## 5b. Commitments (turn knowledge into follow-through)

Knowledge is only worth something if you act on it. **Commitments** are the
follow-through layer — reminders, decision reviews to run, and habits.

- **Natural-language scheduling:** tell the ✦ agent (Capture) “*remind me to
  review the pricing decision next week*”, “*call the bank tomorrow at 9am*”, or
  “*meditate every morning*” and it sets a commitment with the right due date and
  recurrence. You can also add one manually on **`/commitments`** (a free-text
  “when?” box understands “next monday”, “in 3 days”, “2026-07-01”, etc.).
- **Recurring:** daily / weekly / monthly (and “every monday”). Completing a
  recurring commitment automatically spawns the next occurrence.
- **Where they surface (in-app notifications):** a **Dashboard** card shows
  what’s due today / overdue, the **sidebar** shows a count badge, and **Daily
  Review** lists due commitments to close out or snooze.
- **Actions:** ✓ complete, snooze (to tomorrow), or remove. Each commitment can
  carry a priority (low/medium/high).
- **Weekly review + analytics:** `/commitments` shows a guilt-free summary
  (completed this week, follow-through %, day-streak) plus a 6-week completion
  chart and a by-source breakdown.
- **AI-suggested follow-throughs:** when you capture a decision or a question in
  the ✦ agent, it proposes a fitting commitment (e.g. "Review this decision · in
  14 days") that you **confirm before it saves** — never auto-created.

---

## 5c. Proactive intelligence (it notices things for you)

Lattice studies your data and surfaces a small, dismissible set of **insight
triggers** on the Dashboard ("✨ For you"):

- **DecisionReviewReady** — a decision is old enough to grade.
- **MistakeWarning** — something you just captured echoes a past lesson.
- **ForgottenQuestion** — an open question has gone quiet.
- **EmergingInterest** / **RepeatedPattern** — a tag/theme is accelerating or
  recurring across many entries.
- **ProjectStalled** — an active project with no recent movement.
- **CommitmentOpportunity** — a recent decision/lesson with no follow-through
  yet (one tap to add a reminder).

Triggers are computed from your data and remembered by a stable key, so
**dismissing one keeps it gone** and a resolved condition clears itself.

**Notifications.** In-app nudges + the sidebar badge always work. If you add
**VAPID keys**, Lattice also sends **Web Push** (a daily digest of what's due and
what's new, via a Vercel Cron) even when the app is closed — enable it from the
toggle on `/commitments`. Without VAPID keys, push is silently skipped.

**Graph.** Commitments tied to an entry appear as teal satellite nodes linked to
their source, so the graph shows knowledge *and* the action it spawned.

---

## 6. Every screen

- **Dashboard (`/`)** — greeting, animated area stats, recent entries, nudges
  (decisions to review, open questions, thinking-partner shortcut).
- **Capture (＋)** — Quick Capture + manual area picker.
- **Area lists** — `/decisions`, `/lessons`, `/aha`, `/questions`, `/projects`.
- **Entry detail (`/entry/[id]`)** — fields, meta, tags, review card
  (Expected/Actual), project children, and the **Connections** panel (existing +
  suggested + "✦ Ask AI why"). Edit / Delete.
- **Test Me (`/learn`)** — active-recall flashcards on your lessons & aha
  moments; AI-written recall questions, Reveal, rate Got it / Fuzzy.
- **Commitments (`/commitments`)** — follow-throughs grouped by Overdue / Today
  / Upcoming, a quick-add box with natural-language dates, complete/snooze/
  remove, and a weekly follow-through summary.
- **Daily Review (`/review`)** — commitments due, decisions ready to judge,
  resurfaced lessons/insights, and "on this day."
- **Reflections (`/reflect`)** — proactive weekly/monthly coach: takeaways,
  patterns, *which decisions to review*, *which entries to connect*.
- **Patterns (`/patterns`)** — attention distribution, decision calibration,
  recurring themes, emerging interests, most-connected hubs, + **AI Judgment**.
- **Knowledge Graph (`/graph`)** — interactive force-directed map; auto-builds as
  you capture (auto-connect). Drag, zoom, tap.
- **Life Timeline (`/timeline`)** — chronological evolution.
- **Search (`/search`)** — recall anything across every area.
- **How to use (?)** — the onboarding guide (auto-shows once on first launch).

---

## 7. Cross-cutting

- **⌘K / "Find" palette** — capture, search, jump anywhere.
- **Auto-connect on capture** — new entries link to tag-related ones, so the
  graph builds itself.
- **Knowledge connections** — manual links, tag/keyword suggestions, and an
  AI "why these relate" insight.
- **Toasts** for action feedback. **PWA**: installable, offline for visited
  pages. **Mobile-first**: bottom tab bar + central capture button.

---

## 8. The AI engine

Provider-agnostic with an automatic **fallback chain** — set any keys; it tries
them in order until one answers (rate-limited/down providers fall through):

`custom (your roster) → Groq → OpenRouter → Cerebras → Mistral → Together → Gemini`

- **Your roster:** `AI_BASE_URL` (ends in `/v1`) + `AI_API_KEY` + `AI_MODEL`
  (optional, defaults to `auto`). Becomes the primary engine; **vision-capable**.
- **Multiple keys per provider** (comma-separated) to dodge per-key limits.
- `AI_PROVIDER_ORDER` to reorder, `AI_PROVIDER` to pin one.
- **Vision:** images sent as OpenAI `image_url` parts / Gemini `inline_data`,
  compressed client-side, with longer timeouts.
- **Robust tool JSON** via `jsonrepair` so agent actions parse reliably.
- AI tasks: `ask`, `reflect`, `connect`, `classify`, `judgment`, `quiz`, plus the
  tool-using `agent` endpoint.
- No keys → every feature falls back to local heuristics; app stays usable.

---

## 9. Architecture & data

- **Framework:** Next.js 16 (App Router, React 19, TS), Tailwind v4, `motion`.
- **DB:** Prisma 7 + **libSQL** adapter — a local SQLite file (`dev.db`) in dev,
  hosted **Turso** in prod, switched by env. Schema **auto-creates on first boot**
  (`src/instrumentation.ts` → `ensureSchema`), so an empty prod DB just works.
- **Data model:** `Entry` (type, title, summary, status, confidence,
  `fields` JSON [type-specific + Details + review fields + reviewedAt],
  occurredAt, timestamps, projectId self-relation); `Tag`/`EntryTag`;
  `Connection` (undirected); `Commitment` (title, status, dueDate, recurringRule,
  priority, source); `InsightTrigger` (key, type, status — proactive nudges);
  `PushSubscription` (Web Push endpoints).
- **Flow:** Server Components read via `src/lib/entries.ts` (Prisma) directly;
  client mutations hit **API route handlers** then refresh / update optimistically.

### Key files
```
src/lib/types.ts        area + field config (drives forms, detail, agent schema)
src/lib/entries.ts      data access, tags, search, suggestions, auto-link, review
src/lib/commitments.ts  commitments data + natural-language date/recurrence parsing
src/lib/insights.ts     proactive insight-trigger generation (dismiss-aware)
src/lib/push.ts         optional Web Push (VAPID) — no-ops without keys
src/lib/ai.ts           provider engine, fallback chain, vision
src/lib/agent.ts        tool-using agent loop
src/lib/companion.ts    reflect / connect / classify / judgment / quiz / ask
src/lib/image.ts        client-side image compression
src/lib/db.ts           Prisma client + libSQL adapter
src/instrumentation.ts  auto-creates schema on boot
src/components/FloatingChat.tsx   the ✦ chat (modes, voice, photo, drag)
src/app/api/{agent,ai,entries,connections,search}/   route handlers
```

---

## 10. Run & deploy

**Local**
```bash
npm install        # generates Prisma client
npm run db:setup   # create dev.db
npm run db:seed    # sample data (optional)
npm run dev
```

**Deploy (phone-friendly)**
1. Create a free **Turso** DB; copy the URL + a token.
2. **Vercel** → import repo → set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and
   an AI key (your roster: `AI_BASE_URL` + `AI_API_KEY` [+ `AI_MODEL`], or
   `GROQ_API_KEY`, etc.) → Deploy. Schema auto-creates; pushes to `main`
   auto-redeploy.
3. Open the URL on your phone → **Add to Home Screen**.
4. *(Optional)* **Semantic matching:** set `EMBEDDINGS_MODEL` (e.g.
   `text-embedding-3-small`; base URL/key default to `AI_BASE_URL`/`AI_API_KEY`)
   to power meaning-based MistakeWarning. Off → lexical (tag/word) matching.
5. *(Optional)* **Web Push:** set `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
   (generate with `npx web-push generate-vapid-keys`), optionally `VAPID_SUBJECT`
   (a `mailto:` URL) and `CRON_SECRET`. A Vercel Cron (`vercel.json`, daily 08:00)
   hits `/api/cron/notify` to send the digest. Skip this and the app uses in-app
   nudges only.

**Scripts:** `dev`, `build`, `start`, `lint`, `db:setup`, `db:seed`,
`db:reset`, `db:turso`.

---

## 11. A day with Lattice

Capture in the moment (type / speak / **snap a photo**) → it auto-connects →
**Daily Review** grades old decisions and resurfaces lessons → **Test Me** drills
your insights → **Reflections** coach your week → **Patterns / Judgment** show how
your thinking is improving → **Search / Graph** recall and explore. Every entry
gets more valuable over time.
