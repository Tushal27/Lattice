"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

type Status = { connected: boolean; login: string | null };

// Connect GitHub with a read-only Personal Access Token so the assistant can
// distill your recent engineering activity into knowledge.
export function GitHubConnect() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await (await fetch("/api/github/status")).json()) as Status;
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus({ connected: false, login: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    const tok = tokenInput.trim();
    if (!tok || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't connect");
      setStatus({ connected: true, login: data.login });
      setTokenInput("");
      toast(`GitHub connected as @${data.login}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    if (busy) return;
    setBusy(true);
    setLastSync(null);
    try {
      const res = await fetch("/api/github/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sync failed");
      setLastSync(data.message ?? "Done.");
      if (data.ok && !data.skipped) {
        toast("Captured engineering activity");
        router.refresh();
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/github/disconnect", { method: "POST" });
      setStatus({ connected: false, login: null });
      setLastSync(null);
      toast("GitHub disconnected");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const base = "rounded-2xl border p-5";

  if (!status.connected) {
    return (
      <div className={`${base} border-zinc-800/80 bg-zinc-900/40`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">🐙 GitHub</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          Paste a read-only{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 hover:underline"
          >
            Personal Access Token
          </a>{" "}
          (fine-grained, read access to repos &amp; commits). The assistant distills your recent work into knowledge.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") connect();
            }}
            placeholder="ghp_… or github_pat_…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
          />
          <button
            onClick={connect}
            disabled={busy || !tokenInput.trim()}
            className="press shrink-0 rounded-lg bg-violet-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${base} border-emerald-500/20 bg-emerald-500/5`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-100">🐙 GitHub connected</h3>
      {status.login && <p className="mt-0.5 text-xs text-emerald-200/70">@{status.login}</p>}
      <p className="mt-1.5 text-sm text-zinc-300">Distills your recent commits across repos into an engineering note.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={sync}
          disabled={busy}
          className="press rounded-lg bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "Pulling…" : "✦ Capture recent activity"}
        </button>
        <button
          onClick={disconnect}
          disabled={busy}
          className="press rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      {lastSync && <p className="mt-3 text-sm text-emerald-200/80">{lastSync}</p>}
    </div>
  );
}
