import Link from "next/link";
import { GraphCanvas, type GraphEdge, type GraphNode } from "@/components/GraphCanvas";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const [entries, connections, commitments] = await Promise.all([
    prisma.entry.findMany({ select: { id: true, type: true, title: true, projectId: true } }),
    prisma.connection.findMany({ select: { fromId: true, toId: true } }),
    prisma.commitment.findMany({
      where: { status: { not: "cancelled" } },
      select: { id: true, title: true, sourceId: true },
    }),
  ]);

  const nodes: GraphNode[] = entries.map((e) => ({ id: e.id, type: e.type, title: e.title }));

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  for (const c of connections) {
    if (ids.has(c.fromId) && ids.has(c.toId)) edges.push({ source: c.fromId, target: c.toId, kind: "connection" });
  }
  for (const e of entries) {
    if (e.projectId && ids.has(e.projectId)) edges.push({ source: e.projectId, target: e.id, kind: "project" });
  }
  // Show commitments that are tied to an entry as satellite nodes.
  for (const c of commitments) {
    if (c.sourceId && ids.has(c.sourceId)) {
      const nodeId = `commitment:${c.id}`;
      nodes.push({ id: nodeId, type: "commitment", title: c.title });
      edges.push({ source: c.sourceId, target: nodeId, kind: "commitment" });
    }
  }

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon="🕸️"
        accentColor="violet"
        title="Knowledge Graph"
        subtitle="Your lattice of understanding. Drag to explore, scroll to zoom, click a node to open it."
      />
      {nodes.length === 0 ? (
        <EmptyState
          icon="🕸️"
          title="The graph is empty"
          hint="Capture entries and they auto-connect by shared tags — watch your web of understanding grow."
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
        <GraphCanvas nodes={nodes} edges={edges} />
      )}
    </div>
  );
}
