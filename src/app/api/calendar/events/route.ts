import { calendarConnected, calendarEnabled, upcomingEvents } from "@/lib/calendar";

export async function GET() {
  if (!calendarEnabled() || !(await calendarConnected())) {
    return Response.json({ connected: false, events: [] });
  }
  const events = await upcomingEvents({ days: 2, max: 15 });
  return Response.json({ connected: true, events });
}
