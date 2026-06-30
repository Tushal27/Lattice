"use client";

import { useState } from "react";
import { toast } from "@/components/Toast";

interface Contact {
  name: string;
  email: string;
}

// Lets you browse the exact name → email pairs the assistant can send to, so
// "who can I email by name?" has a concrete answer. Loads on first open.
export function ContactsList({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setBusy(true);
      try {
        const res = await fetch("/api/contacts");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { contacts: Contact[] };
        setContacts(data.contacts ?? []);
        setLoaded(true);
      } catch {
        toast("Couldn't load contacts", "error");
        setOpen(false);
      } finally {
        setBusy(false);
      }
    }
  }

  const filter = q.trim().toLowerCase();
  const shown = filter
    ? contacts.filter((c) => c.name.toLowerCase().includes(filter) || c.email.toLowerCase().includes(filter))
    : contacts;

  if (count <= 0) return null;

  return (
    <div className="mt-2">
      <button onClick={toggle} className="text-xs font-medium text-sky-300 hover:underline">
        {open ? "Hide contacts" : `See the ${count} contacts I can email →`}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
              Loading contacts…
            </p>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or email…"
                className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
              />
              {shown.length === 0 ? (
                <p className="text-sm text-zinc-500">{contacts.length === 0 ? "No contacts found." : "No matches."}</p>
              ) : (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {shown.map((c) => (
                    <li
                      key={`${c.name}-${c.email}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5"
                    >
                      <span className="min-w-0 truncate text-sm text-zinc-200">{c.name}</span>
                      <span className="shrink-0 truncate text-xs text-emerald-300/80">{c.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
