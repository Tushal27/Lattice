"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

// urlBase64 → ArrayBuffer, the applicationServerKey format subscribe() expects.
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

type State = "loading" | "unsupported" | "disabled" | "off" | "on" | "denied";

export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setState("unsupported");
        return;
      }
      let cfg: { enabled?: boolean; publicKey?: string } = {};
      try {
        cfg = await (await fetch("/api/push")).json();
      } catch {}
      if (cancelled) return;
      if (!cfg.enabled || !cfg.publicKey) {
        setState("disabled");
        return;
      }
      setPublicKey(cfg.publicKey);
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(publicKey),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error();
      setState("on");
      toast("Notifications enabled");
    } catch {
      toast("Couldn't enable notifications", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifications turned off");
    } catch {
      toast("Couldn't turn off notifications", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
  }

  if (state === "loading" || state === "unsupported") return null;

  const base = "rounded-2xl border p-4 text-sm";

  if (state === "disabled") {
    return (
      <div className={`${base} border-zinc-800/80 bg-zinc-900/40 text-zinc-400`}>
        🔔 In-app reminders and the badge are active. To get push notifications when the app is closed, add{" "}
        <code className="rounded bg-white/10 px-1 text-zinc-200">VAPID</code> keys in your deployment.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={`${base} border-amber-500/20 bg-amber-500/5 text-amber-200/80`}>
        🔔 Notifications are blocked in your browser settings. Re-allow them for this site to get reminders.
      </div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-between gap-3 border-emerald-500/20 bg-emerald-500/5`}>
      <div className="text-zinc-200">
        🔔 {state === "on" ? "Push notifications are on" : "Get reminded even when Lattice is closed"}
      </div>
      <div className="flex items-center gap-2">
        {state === "on" ? (
          <>
            <button onClick={test} className="press rounded-lg px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">
              Send test
            </button>
            <button
              onClick={disable}
              disabled={busy}
              className="press rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-50"
            >
              Turn off
            </button>
          </>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="press rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Enable
          </button>
        )}
      </div>
    </div>
  );
}
