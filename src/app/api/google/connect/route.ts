import { authUrl, googleEnabled } from "@/lib/google";

// Start Google OAuth — one consent grants Gmail (read) + Calendar (read/write).
export async function GET(request: Request) {
  if (!googleEnabled()) {
    return Response.json(
      { error: "Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  const origin = new URL(request.url).origin;
  return Response.redirect(authUrl(origin), 302);
}
