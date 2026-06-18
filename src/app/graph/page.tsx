import { GraphCanvas, type GraphEdge, type GraphNode } from "@/components/GraphCanvas";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const [entries, connections] = await Promise.all([
    prisma.entry.findMany({ select: { id: true, type: true, title: true, projectId: true } }),
    prisma.connection.findMany({ select: { fromId: true, toId: true } }),
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

  return (
    <div className="animate-[fadeUp_0.4s_ease-out]">
      <PageHeader
        icon="🕸️"
        accentColor="violet"
        title="Knowledge Graph"
        subtitle="Your lattice of understanding. Drag to explore, scroll to zoom, click a node to open it."
      />
      {nodes.length === 0 ? (
        <EmptyState icon="🕸️" title="The graph is empty" hint="Capture and connect entries to grow your network." />
      ) : (
        <GraphCanvas nodes={nodes} edges={edges} />
      )}
    </div>
  );
}
