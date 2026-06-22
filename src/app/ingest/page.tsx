import { IngestRunner } from "@/components/IngestRunner";

export const dynamic = "force-dynamic";

// Bookmarklet / quick-capture landing: /ingest?url=<page> captures the link.
export default async function IngestPage(props: PageProps<"/ingest">) {
  const sp = await props.searchParams;
  const raw = sp.url;
  const url = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <IngestRunner url={url} />
    </div>
  );
}
