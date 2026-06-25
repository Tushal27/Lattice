import { CAPABILITIES, getTrust } from "@/lib/capabilities";
import { getContacts } from "@/lib/contacts";
import { prisma } from "@/lib/db";
import { googleConnected, googleEnabled } from "@/lib/google";
import { runHeartbeat } from "@/lib/heartbeat";
import { pushEnabled, subscriptionCount } from "@/lib/push";

export const dynamic = "force-dynamic";

function authed(request: Request, url: URL): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

// POST = run the heartbeat (Vercel Cron with ?slot=…, or GitHub Actions w/o slot).
async function run(request: Request) {
  const url = new URL(request.url);
  if (!authed(request, url)) return new Response("Unauthorized", { status: 401 });
  const slotParam = url.searchParams.get("slot");
  const slot = slotParam === "morning" || slotParam === "evening" ? slotParam : null;
  const result = await runHeartbeat(slot);
  return Response.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return run(request);
}

// GET = a no-side-effect health snapshot, so you can verify the pipeline is live:
//   curl https://app/api/cron/tick?secret=…
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!authed(request, url)) return new Response("Unauthorized", { status: 401 });

  const connected = googleEnabled() ? await googleConnected() : false;
  const [subs, last, autos, contacts] = await Promise.all([
    subscriptionCount().catch(() => 0),
    prisma.appState.findUnique({ where: { key: "hb:last" } }).catch(() => null),
    Promise.all(CAPABILITIES.map(async (c) => ({ key: c.key, trust: await getTrust(c.key) }))),
    // Force a live fetch so this reflects whether People API actually returns data.
    connected ? getContacts(true).then((l) => l.length).catch(() => -1) : 0,
  ]);

  return Response.json({
    ok: true,
    health: {
      pushEnabled: pushEnabled(),
      pushSubscriptions: subs,
      googleConfigured: googleEnabled(),
      googleConnected: connected,
      googleContacts: contacts, // count from a live People API call (-1 = call failed)
      lastHeartbeat: last?.value ?? null,
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      capabilities: autos,
    },
    hint: "POST this URL to run the heartbeat. Vercel Cron adds ?slot=morning|evening; GitHub Actions calls it bare every 15 min.",
  });
}
