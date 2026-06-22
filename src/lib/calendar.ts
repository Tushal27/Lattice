import { accessToken, googleConnected, googleEnabled } from "@/lib/google";

// Google Calendar — awareness (read upcoming events) and action (create events
// and review blocks). OAuth lives in google.ts. Read/write is gated by the
// calendar.create_event capability trust for writes; reads are always safe.

export const calendarEnabled = googleEnabled;
export const calendarConnected = googleConnected;

export interface CalEvent {
  id: string;
  summary: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  htmlLink?: string;
}

interface GApiEvent {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Upcoming events across the next `days` (default 2), time-ordered. */
export async function upcomingEvents(opts: { days?: number; max?: number } = {}): Promise<CalEvent[]> {
  const token = await accessToken();
  if (!token) return [];
  const days = opts.days ?? 2;
  const max = opts.max ?? 15;

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * 86400000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: GApiEvent[] };

  return (data.items ?? []).map((e) => {
    const allDay = Boolean(e.start?.date && !e.start?.dateTime);
    return {
      id: e.id,
      summary: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay,
      location: e.location,
      htmlLink: e.htmlLink,
    };
  });
}

export interface NewEvent {
  summary: string;
  description?: string;
  start: Date;
  end?: Date; // defaults to start + 30m
  location?: string;
}

/** Create an event on the primary calendar. Returns the created event id + link. */
export async function createEvent(ev: NewEvent): Promise<{ id: string; htmlLink?: string } | null> {
  const token = await accessToken();
  if (!token) return null;
  const end = ev.end ?? new Date(ev.start.getTime() + 30 * 60000);

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description,
      location: ev.location,
      start: { dateTime: ev.start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string; htmlLink?: string };
  return { id: data.id, htmlLink: data.htmlLink };
}
