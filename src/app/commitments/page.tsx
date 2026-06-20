import { CommitmentList } from "@/components/CommitmentList";
import { PageHeader } from "@/components/ui";
import { commitmentWeeklyReview, groupedCommitments } from "@/lib/commitments";

export const dynamic = "force-dynamic";

// Dates don't cross the RSC boundary cleanly into a client component's fetch
// refresh cycle, so serialize to the same JSON shape the API returns.
function serialize<T extends { dueDate: Date | null; completedAt: Date | null; createdAt: Date }>(c: T) {
  return {
    ...c,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export default async function CommitmentsPage() {
  const [groups, review] = await Promise.all([groupedCommitments(), commitmentWeeklyReview()]);
  const initial = {
    overdue: groups.overdue.map(serialize),
    today: groups.today.map(serialize),
    upcoming: groups.upcoming.map(serialize),
    done: groups.done.map(serialize),
  };

  return (
    <div className="animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="🎯"
        accentColor="emerald"
        title="Commitments"
        subtitle="The follow-throughs your knowledge asks of you — reminders, reviews, and habits. Capture them by voice in the ✦ agent (“remind me to… next week”) or add one below."
      />
      <CommitmentList initial={initial} review={review} />
    </div>
  );
}
