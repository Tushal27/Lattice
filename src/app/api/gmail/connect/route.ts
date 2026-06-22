import { authUrl, gmailEnabled } from "@/lib/gmail";

// Kick off the Google OAuth flow: redirect the user to Google's consent screen.
export async function GET(request: Request) {
  if (!gmailEnabled()) {
    return Response.json(
      { error: "Gmail is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  const origin = new URL(request.url).origin;
  return Response.redirect(authUrl(origin), 302);
}
