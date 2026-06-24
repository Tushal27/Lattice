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

/** Move an event to a new start (keeps duration unless an end is given). */
export async function updateEvent(id: string, start: Date, end?: Date): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const finalEnd = end ?? new Date(start.getTime() + 30 * 60000);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: finalEnd.toISOString() } }),
  });
  return res.ok;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 410; // 410 = already gone
}

export interface FreeSlot {
  start: string;
  end: string;
}

/**
 * Find open slots of at least `durationMin` over the next `withinDays`, within
 * working hours (local). Computed by subtracting busy events from each day's
 * window. `tz` is minutes east of UTC.
 */
export async function findFreeSlots(opts: {
  durationMin?: number;
  withinDays?: number;
  dayStart?: number;
  dayEnd?: number;
  tz?: number;
}): Promise<FreeSlot[]> {
  const token = await accessToken();
  if (!token) return [];
  const durationMin = opts.durationMin ?? 30;
  const withinDays = Math.min(opts.withinDays ?? 5, 14);
  const dayStart = opts.dayStart ?? 9;
  const dayEnd = opts.dayEnd ?? 18;
  const tz = opts.tz ?? 0;
  const durMs = durationMin * 60000;

  const events = await upcomingEvents({ days: withinDays + 1, max: 80 });
  const busy = events
    .filter((e) => !e.allDay && e.start && e.end)
    .map((e) => ({ s: new Date(e.start).getTime(), e: new Date(e.end).getTime() }))
    .sort((a, b) => a.s - b.s);

  // The instant for day-offset `d` at local hour `h`.
  const localInstant = (d: number, h: number) => {
    const base = new Date(Date.now() + tz * 60000);
    base.setUTCDate(base.getUTCDate() + d);
    base.setUTCHours(h, 0, 0, 0);
    return base.getTime() - tz * 60000;
  };

  const slots: FreeSlot[] = [];
  const now = Date.now();
  for (let d = 0; d <= withinDays && slots.length < 8; d++) {
    const windowStart = Math.max(now, localInstant(d, dayStart));
    const windowEnd = localInstant(d, dayEnd);
    if (windowEnd <= windowStart) continue;
    let cursor = windowStart;
    for (const b of busy) {
      if (b.e <= cursor || b.s >= windowEnd) continue;
      if (b.s - cursor >= durMs) slots.push({ start: new Date(cursor).toISOString(), end: new Date(cursor + durMs).toISOString() });
      cursor = Math.max(cursor, b.e);
      if (cursor >= windowEnd) break;
      if (slots.length >= 8) break;
    }
    if (windowEnd - cursor >= durMs && slots.length < 8) {
      slots.push({ start: new Date(cursor).toISOString(), end: new Date(cursor + durMs).toISOString() });
    }
  }
  return slots;
}
