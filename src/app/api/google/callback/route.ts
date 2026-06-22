import { exchangeCode, googleEnabled } from "@/lib/google";

// Google redirects back here with an authorization code. Exchange for tokens,
// persist, then return the user to Settings.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (!googleEnabled()) return Response.redirect(`${origin}/settings?google=disabled`, 302);

  const error = url.searchParams.get("error");
  if (error) return Response.redirect(`${origin}/settings?google=denied`, 302);

  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${origin}/settings?google=nocode`, 302);

  try {
    await exchangeCode(code, origin);
    return Response.redirect(`${origin}/settings?google=connected`, 302);
  } catch {
    return Response.redirect(`${origin}/settings?google=error`, 302);
  }
}
