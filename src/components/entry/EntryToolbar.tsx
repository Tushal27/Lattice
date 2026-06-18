"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function EntryToolbar({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/entry/${id}/edit`}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        Edit
      </Link>
      {confirming ? (
        <>
          <button
            onClick={remove}
            disabled={deleting}
            className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-rose-500/40 hover:text-rose-400"
        >
          Delete
        </button>
      )}
    </div>
  );
}
