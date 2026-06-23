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
    "• ✦ Capture — the agent files what you say into the right entry (works from typing, voice 🎤, or a photo 📷); it fills the fields and auto-links related entries. The agent can also set commitments/reminders and, when allowed, add events to your Google Calendar.",
    "• 🧠 Wonder — this chat: think out loud and get answers grounded in your entries; replies stream in live; nothing is saved unless you tap “✦ Save this”.",
    "Also: Quick Capture on /capture sorts a raw thought into the right area, or pick an area manually.",
    "",
    "VOICE CONVERSATION (hands-free): the 🎙️ button in this chat's header starts a continuous voice mode — it listens, answers out loud, then listens again. Tap it again to stop. (Plain dictation 🎤 is also on every input.)",
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
    "",
    "DAILY/EVENING BRIEF (top of the dashboard): a short, written read of your world right now — calendar, commitments due, decisions to judge, live insights, money. It’s a morning look-ahead and an evening look-back; if push is on, it’s also sent to your phone morning and evening.",
    "",
    "SETTINGS (open it from the ⚙️ in the mobile top bar, the sidebar on desktop, or “Find”/⌘K → “Settings”). Everything below lives there, with quick-jump chips:",
    "• 🔗 INTEGRATIONS — Connect Google (one tap grants read-only Gmail + read/write Calendar). Gmail: “Scan inbox now” turns real action items in recent mail into commitments. Calendar: upcoming events show in the brief, and the assistant can add events. Connect GitHub with a read-only token to distill your recent commits into an engineering note.",
    "• 📥 INGEST KNOWLEDGE — paste a link (article, page, YouTube, GitHub repo) or upload a text/markdown file and it’s distilled into a note. There’s a “Save to Lattice” bookmarklet for one-click web capture, and the phone Share sheet → Lattice works too.",
    "• 🤖 TRUST & AUTONOMY — each capability has a dial: Off, Ask (it proposes, you confirm), or Auto (it acts, then tells you). Autonomy can auto-schedule decision-review blocks on your calendar, resurface forgotten work, and flag spending drift. Tune review age, schedule time, and quiet hours; “Run now” triggers it on demand. Defaults are conservative.",
    "• 🧠 MEMORY — “What I remember about you”: durable facts the assistant keeps in mind (auto-learned from chats, and you can add/remove your own). It’s server-side, so it carries across devices and into new chat threads. The rolling chat memory lives here too.",
    "• 🔔 NOTIFICATIONS — enable push (needs VAPID configured) for briefs and nudges.",
    "• 🧾 ACTIVITY — an audit log of everything the assistant has done for you (captures, scheduled events, nudges).",
    "",
    "POWER-UPS (configured on the server via env): your AI provider/roster, Semantic memory (embeddings — embed older entries from the card on /commitments), Push (VAPID), and Google OAuth (GOOGLE_CLIENT_ID/SECRET) for Gmail+Calendar. Integrations stay inert until their keys are set; nothing breaks without them.",
    "When the user is confused, point to the exact screen and action (e.g. “Settings → Integrations → Connect Google”, or “open the goal → Funding this goal → tap Link on your SIP”). Be concrete. If they ask what you can do, mention the relevant feature above and where to find it.",
  ].join("\n");
}
