import { notFound } from "next/navigation";
import { AreaView } from "@/components/AreaView";
import { SLUG_TO_TYPE } from "@/lib/types";

export const dynamic = "force-dynamic";

// One generic area page for every entry type in every module (slug → type).
export default async function AreaSlugPage({ params }: PageProps<"/area/[slug]">) {
  const { slug } = await params;
  const type = SLUG_TO_TYPE[slug];
  if (!type) notFound();
  return <AreaView type={type} />;
}
