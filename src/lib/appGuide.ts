import { MODULES } from "@/lib/types";

/**
 * A living, concise guide to how Lattice works, given to Wonder so it can also
 * be the in-app help — answering "how does X work?" / "where do I…?".
 *
 * The module/area list is generated from the registry, so new modules and types
 * appear automatically. The feature prose is maintained here as the single
 * source of truth — update it when features change and it ships with the deploy,
 * so Wonder's knowledge stays current.
 */
export function appGuide(): string {
  const modules = MODULES.map(
    (m) => `- ${m.name}: ${m.types.map((t) => `${t.label} (${t.icon})`).join(", ")}`,
  ).join("\n");

  return [
    "HOW LATTICE WORKS — use this to answer questions about the app itself and its features:",
    "Lattice is a personal operating system / second brain: capture how you think (decisions, lessons, aha moments, questions, projects, and module-specific types) so your knowledge and judgment compound over years. One shared brain — everything cross-connects.",
    "",
    "CAPTURING: tap the floating ✦ button. Two modes:",
    "• ✦ Capture — the agent files what you say into the right entry (works from typing, voice 🎤, or a photo 📷); it fills the fields and auto-links related entries.",
    "• 🧠 Wonder — this chat: think out loud and get answers grounded in your entries; nothing is saved unless you tap “✦ Save this”.",
    "Also: Quick Capture on /capture sorts a raw thought into the right area, or pick an area manually.",
    "",
    "AREAS BY MODULE (switch the dashboard lens with the pills at the top):",
    modules,
    "",
    "DAILY REVIEW (/review): decisions, financial decisions and investments become “ready to judge” ~14 days after you make them — record what actually happened, a verdict (right/mixed/wrong call), would-you-repeat, and the lesson. It also resurfaces old lessons and shows “on this day”.",
    "COMMITMENTS (/commitments): reminders, reviews and habits in plain language — “remind me to review the pricing decision next monday”, “meditate every morning”. Recurring is supported; completing one asks what you took from it (saved as a lesson/aha/question). There’s a weekly follow-through summary.",
    "PROACTIVE INSIGHTS (the “✨ For you” feed on the dashboard): decision-ready, MistakeWarning (you’re about to repeat a past lesson), forgotten questions, emerging interests, repeated patterns, stalled projects — plus money insights (regret patterns, subscription waste, positive-ROI categories, spending drift, goal risk, overconfidence). Dismiss any you don’t want.",
    "MONEY OS (/money): log spend in seconds with a “worth it?” rating; capture financial decisions & investments you grade later; set goals with a real projection (will your monthly contribution + assumed return hit the target by the deadline, and if not, the monthly needed). Link the SIPs that fund a goal on the goal’s page → “Funding this goal”. A money reflection summarizes month/quarter/year.",
    "REFLECTIONS (/reflect): AI weekly/monthly coaching across your entries.",
    "PATTERNS (/patterns): your attention split, decision calibration, and AI judgment analysis (are your confident calls actually right?).",
    "GRAPH (/graph): entries auto-connect by shared tags and meaning; commitments appear as satellite nodes. SEARCH (/search) and TEST ME (/learn, active-recall flashcards) round it out.",
    "CONNECTIONS: entries auto-link on capture; an entry’s page suggests genuinely related entries (by meaning) and you can link manually.",
    "POWER-UPS (configured on the server): Semantic memory (EMBEDDINGS_MODEL — matches by meaning; you can embed older entries with one tap on the card on /commitments) and Push notifications (VAPID — toggle on /commitments).",
    "When the user is confused, point to the exact screen and action (e.g. “open the goal → Funding this goal → tap Link on your SIP”). Be concrete.",
  ].join("\n");
}
