import Link from "next/link";
import { ContactsList } from "@/components/ContactsList";
import { PeopleSync } from "@/components/PeopleSync";
import { EmptyState, PageHeader } from "@/components/ui";
import { attachEmails, listPeople, type ContactsState } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { people, state } = await attachEmails(await listPeople());

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
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
          <ContactsBanner state={state} total={people.length} />
          {state.withEmail > 0 && <ContactsList count={state.withEmail} />}
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
                  ) : state.withEmail > 0 ? (
                    <p className="text-[11px] text-zinc-600">not in Contacts — not sendable</p>
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

const settingsLink = (
  <Link href="/settings" className="font-medium text-sky-300 hover:underline">
    Settings
  </Link>
);

// Tells the true story of why people do/don't have emails, so a public figure
// who isn't a contact, a missing permission, and a disconnected account never
// get collapsed into one misleading "not connected" message.
function ContactsBanner({ state, total }: { state: ContactsState; total: number }) {
  if (!state.googleConnected) {
    return (
      <p>
        Google Contacts isn&apos;t connected, so no one shows an email yet. Connect it in {settingsLink} to email people
        by name.
      </p>
    );
  }

  if (state.withEmail > 0) {
    return (
      <p>
        <span className="font-medium text-emerald-300">{state.matched}</span> of {total} can be emailed by name — look
        for the <span className="font-medium text-emerald-300">✉︎ email</span> badge.{" "}
        {state.matched < total
          ? "The rest aren't in your Google Contacts, so the assistant won't try to send to them."
          : "Everyone here is in your Contacts."}
      </p>
    );
  }

  // Connected, but nothing emailable came back — say exactly why.
  if (state.status >= 400) {
    return (
      <p>
        Google is connected, but the Contacts permission wasn&apos;t granted (HTTP {state.status}). Reconnect in{" "}
        {settingsLink} and make sure you allow <span className="text-zinc-300">Contacts</span> on the consent screen.
      </p>
    );
  }
  if (state.status === 200 && state.saved > 0) {
    return (
      <p>
        Google is connected and you have <span className="text-zinc-300">{state.saved}</span> saved contacts, but{" "}
        <span className="text-amber-300">none has an email address</span> stored (likely phone-only) — so there&apos;s no
        one to email by name yet. Add emails to them in Google Contacts, or reconnect in {settingsLink} to also pull in
        people auto-collected from your mail.
      </p>
    );
  }
  if (state.status === 200 && state.other > 0) {
    return (
      <p>
        Google is connected, but your contacts are all auto-collected{" "}
        <span className="text-zinc-300">&quot;Other contacts&quot;</span>. Reconnect in {settingsLink} to grant access to
        them, or save them to <span className="text-zinc-300">My Contacts</span>.
      </p>
    );
  }
  if (state.status === 200) {
    return (
      <p>
        Google is connected, but you have no Google Contacts with emails yet. Add some in Google Contacts and
        they&apos;ll become emailable here.
      </p>
    );
  }
  return (
    <p>
      Google is connected, but Contacts couldn&apos;t be reached right now. Try again in a moment, or reconnect in{" "}
      {settingsLink}.
    </p>
  );
}
