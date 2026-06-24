import { gmailConnected, gmailEnabled } from "@/lib/gmail";
import { runInboxScan } from "@/lib/inbox";

// Manual "Scan inbox now": triage recent mail into commitments, draft replies,
// and renewal alerts. (Autonomy runs the same scan automatically when gmail
// capture is set to Auto.)
export async function POST(request: Request) {
  if (!gmailEnabled()) return Response.json({ error: "Gmail not configured." }, { status: 503 });
  if (!(await gmailConnected())) return Response.json({ error: "Gmail not connected." }, { status: 401 });

  const tz = await request
    .json()
    .then((b: { tz?: number }) => (typeof b?.tz === "number" ? b.tz : 0))
    .catch(() => 0);

  const result = await runInboxScan(tz);
  return Response.json(result);
}
