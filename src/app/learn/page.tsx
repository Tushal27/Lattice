import { RecallSession, type RecallCard } from "@/components/RecallSession";
import { PageHeader } from "@/components/ui";
import { recallCandidates } from "@/lib/entries";
import { parseFields } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ANSWER_KEYS = ["lesson", "detail", "whatHappened", "rootCause", "prevention", "trigger"];

export default async function LearnPage() {
  const entries = await recallCandidates(8);
  const cards: RecallCard[] = entries.map((e) => {
    const f = parseFields(e.fields);
    const parts = [e.summary, ...ANSWER_KEYS.map((k) => f[k])].filter(Boolean) as string[];
    return { id: e.id, type: e.type, title: e.title, answer: parts.join("\n\n") };
  });

  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon="🎯"
        accentColor="emerald"
        title="Test Me"
        subtitle="Active recall on your own lessons and aha moments — so your insights actually stick."
      />
      <RecallSession cards={cards} />
    </div>
  );
}
