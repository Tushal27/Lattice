import { getTrust, logAction } from "@/lib/capabilities";
import { gmailConnected, sendEmail } from "@/lib/gmail";

// Send an email the user has reviewed. Gated by the gmail.send_email capability
// (off = blocked) and a live Google connection; every send is audited.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { to?: string; subject?: string; body?: string; cc?: string };
  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const text = String(body.body ?? "");

  if (!to || !/.+@.+\..+/.test(to)) return Response.json({ error: "A valid recipient is required." }, { status: 400 });
  if (!text.trim()) return Response.json({ error: "The email body is empty." }, { status: 400 });

  if ((await getTrust("gmail.send_email")) === "off") {
    return Response.json({ error: "Sending email is turned off in Settings." }, { status: 403 });
  }
  if (!(await gmailConnected())) {
    return Response.json({ error: "Connect Google in Settings first." }, { status: 401 });
  }

  const result = await sendEmail({ to, subject: subject || "(no subject)", body: text, cc: body.cc?.trim() || undefined });
  if (!result.ok) return Response.json({ error: result.error ?? "Send failed." }, { status: 502 });

  await logAction({
    capability: "gmail.send_email",
    summary: `Sent email to ${to}: ${subject || "(no subject)"}`,
    reason: "You reviewed the draft and confirmed sending.",
    source: "gmail",
  });
  return Response.json({ ok: true });
}
