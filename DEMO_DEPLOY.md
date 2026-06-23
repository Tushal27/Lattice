# Deploying a clean Founder Demo instance

Lattice is single-user / single-database — there's no login, so "a fresh
account" means **a separate deployment pointed at its own empty database**. Your
real app keeps all your data untouched; the demo is a disposable, pre-seeded copy
you can share.

This takes ~10 minutes and the demo instance auto-updates whenever you push
(same repo/branch).

---

## 1. Create an empty database (Turso)

Vercel is serverless and ephemeral, so the demo needs a hosted DB to persist the
seeded data.

```bash
# install once: https://docs.turso.tech/cli/installation
turso db create lattice-demo
turso db show lattice-demo --url          # → libsql://lattice-demo-....turso.io
turso db tokens create lattice-demo       # → the auth token
```

Keep the URL and token for step 2. (The schema is created automatically on first
boot — no migrations to run.)

## 2. Create a second Vercel project

- New Project → import the **same GitHub repo** → pick the same branch.
- Add Environment Variables:

| Variable | Value | Needed for |
|---|---|---|
| `TURSO_DATABASE_URL` | the `libsql://…` URL from step 1 | persistence (required) |
| `TURSO_AUTH_TOKEN` | the token from step 1 | persistence (required) |
| `AI_BASE_URL` | your roster base URL | live chat / briefs in the demo |
| `AI_API_KEY` | your roster key | live chat / briefs in the demo |

You can **omit** Google / VAPID / GitHub — the demo's seeded data already shows
those surfaces (insights, money, autonomy history) without live integrations.

- Deploy. Note the URL, e.g. `https://lattice-demo.vercel.app`.

## 3. Seed it once (so it's alive on first open)

Either click through the app's onboarding → **"▶ See it alive"**, or pre-seed it
with one call so even the very first glance is rich:

```bash
curl -X POST https://lattice-demo.vercel.app/api/demo \
  -H 'Content-Type: application/json' -d '{"action":"load"}'
# → {"ok":true,"created":16}
```

Open the URL. The dashboard now shows the brief, due commitments, a live
MistakeWarning, money/goal risk, and a populated graph.

## 4. Reset the demo anytime

```bash
# wipe seeded data
curl -X POST https://lattice-demo.vercel.app/api/demo \
  -H 'Content-Type: application/json' -d '{"action":"clear"}'
# re-seed fresh
curl -X POST https://lattice-demo.vercel.app/api/demo \
  -H 'Content-Type: application/json' -d '{"action":"load"}'
```

(Seeding is idempotent — calling load twice won't duplicate.)

---

## The 5-minute walkthrough to give a founder

1. **Open cold** → 30-second onboarding draws the loop → **"See it alive."**
2. **Dashboard** → the brief, due commitments, and the **MistakeWarning**
   ("you've been here before").
3. **/patterns** → decision calibration (are your confident calls actually right?).
4. **/money** → regret vs. ROI, and a goal flagged off-track.
5. **Settings → Trust & autonomy** → flip a capability **Ask → Auto**, hit
   **Run now**, then **Activity** → see the action logged *with its "Why."**
6. **/architecture** and **/vision** → the depth and the trajectory.

That sequence demonstrates AI-systems depth, product thinking, and safe autonomy
without narration.

---

## Notes

- The demo instance shares your repo, so `git push` redeploys it automatically.
- It's fully isolated: a different database from your real app. Nothing you do in
  the demo touches your personal data, and vice-versa.
- To rotate the demo before a meeting, just run the reset commands in step 4.
