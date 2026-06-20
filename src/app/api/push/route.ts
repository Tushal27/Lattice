import { publicVapidKey, pushEnabled, removeSubscription, saveSubscription, sendPushToAll } from "@/lib/push";

export async function GET() {
  return Response.json({ enabled: pushEnabled(), publicKey: publicVapidKey() });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // A quick "send me a test" path so the user can confirm it works end-to-end.
  if (body.test) {
    const r = await sendPushToAll({ title: "Lattice", body: "Notifications are on 🎉", url: "/commitments" });
    return Response.json(r);
  }

  try {
    const sub = (body.subscription ?? body) as { endpoint: string; keys: { p256dh: string; auth: string } };
    await saveSubscription(sub);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}) as { endpoint?: string });
  if (body.endpoint) await removeSubscription(String(body.endpoint));
  return Response.json({ ok: true });
}
