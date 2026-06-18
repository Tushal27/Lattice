import Link from "next/link";
import { EntryForm } from "@/components/EntryForm";
import { PageHeader } from "@/components/ui";
import { listProjects } from "@/lib/entries";
import { TYPE_LIST, TYPES, isEntryType } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CapturePage(props: PageProps<"/capture">) {
  const { type } = await props.searchParams;
  const selected = typeof type === "string" && isEntryType(type) ? type : null;
  const projects = await listProjects();

  if (!selected) {
    return (
      <div className="animate-[fadeUp_0.4s_ease-out]">
        <PageHeader title="Capture something" subtitle="What kind of moment do you want to preserve?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TYPE_LIST.map((t) => {
            const a = accent(t.accent);
            return (
              <Link
                key={t.type}
                href={`/capture?type=${t.type}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-700",
                )}
              >
                <div className={cn("absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100", a.bg)} />
                <div className="relative">
                  <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl text-xl", a.bg, a.border, "border")}>
                    {t.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-100">{t.label}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{t.tagline}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const cfg = TYPES[selected];
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out]">
      <PageHeader icon={cfg.icon} accentColor={cfg.accent} title={`New ${cfg.label}`} subtitle={cfg.intro} />
      <EntryForm type={selected} projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
    </div>
  );
}
