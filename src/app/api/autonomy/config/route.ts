import { getAutonomyConfig, setAutonomyConfig, type AutonomyConfig } from "@/lib/autonomy";

export async function GET() {
  return Response.json(await getAutonomyConfig());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<AutonomyConfig>;
  const patch: Partial<AutonomyConfig> = {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  if (num(body.reviewAgeDays) !== undefined) patch.reviewAgeDays = Math.max(1, Math.min(120, body.reviewAgeDays!));
  if (num(body.scheduleHour) !== undefined) patch.scheduleHour = Math.max(0, Math.min(23, body.scheduleHour!));
  if (num(body.quietStart) !== undefined) patch.quietStart = Math.max(0, Math.min(23, body.quietStart!));
  if (num(body.quietEnd) !== undefined) patch.quietEnd = Math.max(0, Math.min(23, body.quietEnd!));
  if (num(body.tz) !== undefined) patch.tz = body.tz!;
  return Response.json(await setAutonomyConfig(patch));
}
