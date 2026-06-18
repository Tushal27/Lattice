import { notFound } from "next/navigation";
import { EntryForm } from "@/components/EntryForm";
import { PageHeader } from "@/components/ui";
import { entryToFormValues, getEntry, listProjects } from "@/lib/entries";
import { configFor, isEntryType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditEntryPage(props: PageProps<"/entry/[id]/edit">) {
  const { id } = await props.params;
  const entry = await getEntry(id);
  if (!entry || !isEntryType(entry.type)) notFound();

  const cfg = configFor(entry.type)!;
  const values = entryToFormValues(entry, entry.type);
  const projects = (await listProjects()).filter((p) => p.id !== entry.id);

  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out]">
      <PageHeader icon={cfg.icon} accentColor={cfg.accent} title={`Edit ${cfg.label}`} subtitle={cfg.tagline} />
      <EntryForm
        type={entry.type}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        showReview
        initial={{
          id: entry.id,
          values,
          tags: entry.tags.map((t) => t.tag.name),
          projectId: entry.projectId,
        }}
      />
    </div>
  );
}
