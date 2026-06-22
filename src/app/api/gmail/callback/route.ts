import { exchangeCode, gmailEnabled } from "@/lib/gmail";

// Google redirects back here with an authorization code. Exchange it for tokens,
// persist them, then bounce the user back into the app.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (!gmailEnabled()) {
    return Response.redirect(`${origin}/settings?gmail=disabled`, 302);
  }

  const error = url.searchParams.get("error");
  if (error) return Response.redirect(`${origin}/settings?gmail=denied`, 302);

  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${origin}/settings?gmail=nocode`, 302);

  try {
    await exchangeCode(code, origin);
    return Response.redirect(`${origin}/settings?gmail=connected`, 302);
  } catch {
    return Response.redirect(`${origin}/settings?gmail=error`, 302);
  }
}
