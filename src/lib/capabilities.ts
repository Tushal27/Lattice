import { prisma } from "@/lib/db";

// The trust + audit layer that turns Lattice from "suggests things" into
// "acts for you, on your terms." Two ideas:
//
//  1. Every action the assistant takes is written to ActionLog (auditable).
//  2. Outward-reaching capabilities carry a trust level you control:
//       ask  → propose it, you confirm   (suggest + confirm)
//       auto → just do it, then report    (act + report)
//       off  → never do it
//
// In-app writes (capturing entries/commitments) are always allowed — that's the
// app working. Trust gates the capabilities that reach OUT of Lattice or act
// without you in the loop.

export type Trust = "off" | "ask" | "auto";

export interface CapabilitySpec {
  key: string;
  label: string;
  description: string;
  defaultTrust: Trust;
  /** Outward = leaves Lattice (calendar, email). Shown grouped in settings. */
  outward: boolean;
}

// The capabilities a user can govern. New autonomous powers register here.
export const CAPABILITIES: CapabilitySpec[] = [
  {
    key: "gmail.capture",
    label: "Capture action items from Gmail",
    description: "Scan recent inbox mail and turn real action items into commitments.",
    defaultTrust: "ask",
    outward: true,
  },
  {
    key: "calendar.create_event",
    label: "Create calendar events",
    description: "Let the assistant put events and review blocks on your Google Calendar.",
    defaultTrust: "ask",
    outward: true,
  },
  {
    key: "autonomy.schedule_reviews",
    label: "Auto-schedule decision reviews",
    description: "When a decision is old enough to judge, schedule a review block automatically.",
    defaultTrust: "ask",
    outward: false,
  },
];

const PERM_PREFIX = "perm:";

export async function getTrust(key: string): Promise<Trust> {
  const spec = CAPABILITIES.find((c) => c.key === key);
  const row = await prisma.appState.findUnique({ where: { key: PERM_PREFIX + key } });
  const v = row?.value as Trust | undefined;
  if (v === "off" || v === "ask" || v === "auto") return v;
  return spec?.defaultTrust ?? "ask";
}

export async function setTrust(key: string, trust: Trust): Promise<void> {
  await prisma.appState.upsert({
    where: { key: PERM_PREFIX + key },
    create: { key: PERM_PREFIX + key, value: trust },
    update: { value: trust },
  });
}

export interface TrustView extends CapabilitySpec {
  trust: Trust;
}

export async function listTrust(): Promise<TrustView[]> {
  const rows = await prisma.appState.findMany({ where: { key: { startsWith: PERM_PREFIX } } });
  const map = new Map(rows.map((r) => [r.key.slice(PERM_PREFIX.length), r.value as Trust]));
  return CAPABILITIES.map((c) => ({ ...c, trust: map.get(c.key) ?? c.defaultTrust }));
}

// ---- audit log -------------------------------------------------------------

export interface ActionInput {
  capability: string;
  summary: string;
  status?: "done" | "failed" | "proposed";
  source?: "agent" | "gmail" | "calendar" | "cron" | "autonomous" | "user";
  entityId?: string | null;
}

export async function logAction(input: ActionInput): Promise<void> {
  try {
    await prisma.actionLog.create({
      data: {
        capability: input.capability,
        summary: input.summary,
        status: input.status ?? "done",
        source: input.source ?? "agent",
        entityId: input.entityId ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the action it's recording.
    console.error("logAction failed", err);
  }
}

export interface ActionRow {
  id: string;
  capability: string;
  summary: string;
  status: string;
  source: string;
  entityId: string | null;
  createdAt: Date;
}

export async function recentActions(limit = 50): Promise<ActionRow[]> {
  return prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
