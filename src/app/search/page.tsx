import { EntryCard } from "@/components/EntryCard";
import { SearchBox } from "@/components/SearchBox";
import { EmptyState, PageHeader } from "@/components/ui";
import { searchEntries } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const results = query ? await searchEntries(query) : [];

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader title="Search" subtitle="One place to recall anything you've ever captured." />
      <div className="mb-8">
        <SearchBox initial={query} />
      </div>

      {query ? (
        results.length === 0 ? (
          <EmptyState icon="🔍" title={`No matches for “${query}”`} hint="Try a different word or tag." />
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              {results.length} {results.length === 1 ? "result" : "results"} for “{query}”
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )
      ) : (
        <EmptyState icon="🧠" title="Your perfect memory" hint="Search across every area at once." />
      )}
    </div>
  );
}
