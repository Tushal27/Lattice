import { QuickCapture } from "@/components/QuickCapture";
import { PageHeader } from "@/components/ui";
import { listProjects } from "@/lib/entries";

export const dynamic = "force-dynamic";

// PWA share-target landing. Any app's "Share" sheet can send text/links here;
// we stitch the shared title + text + url into one thought and hand it to
// QuickCapture, which auto-sorts it into the right place — capture from anywhere.
export default async function SharePage(props: PageProps<"/share">) {
  const sp = await props.searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const title = pick(sp.title);
  const text = pick(sp.text);
  const url = pick(sp.url);

  const shared = [title, text, url].map((s) => s.trim()).filter(Boolean).join("\n").trim();

  const projects = await listProjects();

  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon="📥"
        title="Captured from share"
        subtitle="Something you shared into Lattice. I'll sort it into the right place — adjust and save."
      />
      {shared ? (
        <QuickCapture
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          initialText={shared}
          autoSort
        />
      ) : (
        <QuickCapture projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
      )}
    </div>
  );
}
