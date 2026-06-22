import { runAutonomy } from "@/lib/autonomy";
import { prisma } from "@/lib/db";
import { fetchReadable, ingestText } from "@/lib/ingest";

// A small durable job queue. Heavy or deferrable work (background URL ingestion,
// scheduled autonomy) is enqueued and drained by the cron / a drain endpoint, so
// it never blocks a request and survives restarts. Failed jobs retry with backoff
// up to a cap.

const MAX_ATTEMPTS = 4;

export type JobKind = "ingest.url" | "autonomy.run";

export async function enqueueJob(kind: JobKind, payload?: unknown, runAt?: Date): Promise<string> {
  const job = await prisma.job.create({
    data: { kind, payload: payload != null ? JSON.stringify(payload) : null, runAt: runAt ?? new Date() },
  });
  return job.id;
}

// Run one job by kind. Throwing marks it failed (and schedules a retry).
async function handle(kind: string, payload: Record<string, unknown>): Promise<void> {
  switch (kind) {
    case "ingest.url": {
      const url = String(payload.url ?? "");
      if (!url) return;
      const readable = await fetchReadable(url);
      if (!readable || !readable.text.trim()) throw new Error("Couldn't read that link");
      await ingestText({
        provider: "url",
        title: readable.title || url,
        text: `${readable.title}\nSource: ${url}\n\n${readable.text}`,
        externalId: url,
      });
      return;
    }
    case "autonomy.run":
      await runAutonomy();
      return;
    default:
      throw new Error(`Unknown job kind: ${kind}`);
  }
}

export interface DrainResult {
  ran: number;
  done: number;
  failed: number;
}

/** Process due pending jobs. Safe to call repeatedly (cron, on demand). */
export async function drainJobs(max = 20): Promise<DrainResult> {
  const due = await prisma.job.findMany({
    where: { status: "pending", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: max,
  });

  let done = 0;
  let failed = 0;
  for (const job of due) {
    const attempts = job.attempts + 1;
    try {
      const payload = job.payload ? (JSON.parse(job.payload) as Record<string, unknown>) : {};
      await handle(job.kind, payload);
      await prisma.job.update({ where: { id: job.id }, data: { status: "done", attempts } });
      done++;
    } catch (err) {
      const giveUp = attempts >= MAX_ATTEMPTS;
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: giveUp ? "failed" : "pending",
          attempts,
          lastError: String((err as Error)?.message ?? err).slice(0, 500),
          // Exponential backoff: 1m, 4m, 9m, …
          runAt: giveUp ? job.runAt : new Date(Date.now() + attempts * attempts * 60_000),
        },
      });
      failed++;
    }
  }
  return { ran: due.length, done, failed };
}
