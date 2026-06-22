import { recentActions } from "@/lib/capabilities";

// The audit feed: everything the assistant has done on the user's behalf.
export async function GET() {
  const actions = await recentActions(50);
  return Response.json({ actions });
}
