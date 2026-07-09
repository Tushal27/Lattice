// Web Push, optional by design. With VAPID keys set (VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, optional VAPID_SUBJECT) the app can notify the user even
// when it's closed. Without them, every function here is a safe no-op and the
// app falls back to in-app nudges + the badge.

import webpush from "web-push";
import { prisma } from "@/lib/db";
import { fcmEnabled, sendFcmToAll } from "@/lib/fcm";

let configured = false;

export function pushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) || fcmEnabled();
}

export function publicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function ensureConfigured(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:lattice@example.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return true;
}

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Invalid subscription");
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Notification action buttons, e.g. tap-to-rate a spend. */
  actions?: { action: string; title: string }[];
  /** Entry this notification acts on (used by action buttons in the SW). */
  entryId?: string;
}

/** How many devices are subscribed to push — for health/diagnostics. */
export async function subscriptionCount(): Promise<number> {
  return prisma.pushSubscription.count();
}

/** Send to every Web Push subscription AND every native FCM token. Prunes dead. */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  let sent = 0;
  let pruned = 0;

  // Web Push (browser / installed PWA).
  if (ensureConfigured()) {
    const subs = await prisma.pushSubscription.findMany();
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
            pruned++;
          }
        }
      }),
    );
  }

  // Native push (Android app via FCM).
  if (fcmEnabled()) {
    const r = await sendFcmToAll(payload).catch(() => ({ sent: 0, pruned: 0 }));
    sent += r.sent;
    pruned += r.pruned;
  }

  return { sent, pruned };
}
