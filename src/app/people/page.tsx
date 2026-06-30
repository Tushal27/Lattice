import Link from "next/link";
import { PeopleSync } from "@/components/PeopleSync";
import { EmptyState, PageHeader } from "@/components/ui";
import { attachEmails, listPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { people, contactsConnected } = await attachEmails(await listPeople());
  const emailable = people.filter((p) => p.email).length;

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-6">
      <PageHeader
        icon="👥"
        accentColor="sky"
        title="People"
        subtitle="Everyone you work with — and what your brain already knows about them. Built from your notes (Contacts adds their emails)."
        action={<PeopleSync empty={people.length === 0} />}
      />

      {people.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm">
          {contactsConnected ? (
            <p className="text-zinc-400">
              <span className="font-medium text-emerald-300">{emailable}</span> of {people.length} can be emailed by
              name — look for the <span className="font-medium text-emerald-300">✉︎ email</span> badge. The rest have no
              address in your Contacts, so the assistant won&apos;t try to send to them.
            </p>
          ) : (
            <p className="text-zinc-400">
              Google Contacts isn&apos;t connected, so no one shows an email yet.{" "}
              <Link href="/settings" className="font-medium text-sky-300 hover:underline">
                Connect it in Settings
              </Link>{" "}
              to email people by name.
            </p>
          )}
        </div>
      )}

      {people.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No people yet"
          hint="As you capture decisions, meetings, and notes that mention people, they'll show up here with the context you've recorded — so you can prep before you talk to them."
          action={
            <Link
              href="/capture"
              className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2.5 text-sm font-medium text-white"
            >
              ＋ Capture something
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <div key={p.id} className="elev rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/30 to-violet-500/30 text-sm font-semibold text-zinc-100">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-zinc-100">{p.name}</h3>
                  {p.email ? (
                    <p className="truncate text-[11px] text-emerald-300/90" title={p.email}>
                      ✉︎ {p.email}
                    </p>
                  ) : contactsConnected ? (
                    <p className="text-[11px] text-zinc-600">no email — not sendable</p>
                  ) : null}
                </div>
                {p.email && (
                  <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    email
                  </span>
                )}
              </div>

              {p.summary && <p className="mt-3 text-sm leading-relaxed text-zinc-300">{p.summary}</p>}

              {p.mentions.length > 0 && (
                <div className="mt-3 border-t border-white/5 pt-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">Came up in</p>
                  <ul className="space-y-1">
                    {p.mentions.slice(0, 4).map((m) => (
                      <li key={m.entryId} className="truncate">
                        <Link href={`/entry/${m.entryId}`} className="text-sm text-zinc-300 hover:text-white">
                          · {m.title || "an entry"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
