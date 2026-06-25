import Link from "next/link";
import { PeopleSync } from "@/components/PeopleSync";
import { EmptyState, PageHeader } from "@/components/ui";
import { listPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await listPeople();

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-6">
      <PageHeader
        icon="👥"
        accentColor="sky"
        title="People"
        subtitle="Everyone you work with — and what your brain already knows about them. Built from your notes (Contacts adds their emails)."
        action={<PeopleSync empty={people.length === 0} />}
      />

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
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-zinc-100">{p.name}</h3>
                  {p.aka && <p className="truncate text-[11px] text-zinc-500">{p.aka}</p>}
                </div>
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
