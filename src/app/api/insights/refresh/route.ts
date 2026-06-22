import { refreshInsights } from "@/lib/insights";

// Fire-and-forget recompute, triggered from the client AFTER the page is
// interactive — so the heavy insight work never blocks the dashboard render.
export async function POST() {
  const list = await refreshInsights();
  return Response.json({ ok: true, count: list.length });
}
