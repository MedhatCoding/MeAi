import { NextRequest, NextResponse } from "next/server";
import { decryptGoogleSession, encryptGoogleSession, setGoogleSessionCookie, type GoogleSession } from "../../../_lib/google-session";
import { enforceRateLimit } from "../../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithError(siteUrl: string, message: string, status = 302) {
  const target = new URL("/", siteUrl);
  target.searchParams.set("google", "error");
  target.searchParams.set("reason", message);
  return NextResponse.redirect(target, status);
}

export async function GET(request: NextRequest) {
  const rateError = enforceRateLimit(request, "google-oauth-callback", 10);
  if (rateError) return rateError;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.MEAI_GOOGLE_REDIRECT_URI;
  const secret = process.env.MEAI_SESSION_SECRET;
  if (!siteUrl || !clientId || !clientSecret || !redirectUri || !secret || secret.length < 32) {
    return NextResponse.json({ error: "إعدادات Google OAuth غير مكتملة على الخادم." }, { status: 503 });
  }
  const cookie = request.cookies.get("meai_google_oauth_state")?.value;
  const stateParam = request.nextUrl.searchParams.get("state");
  let stateData: { state?: string; verifier?: string } = {};
  try {
    if (cookie) stateData = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8")) as { state?: string; verifier?: string };
  } catch { /* Invalid state cookie */ }

  const stateMatches = Boolean(stateData.state && stateData.verifier && stateParam && stateData.state.length === stateParam.length
    && Buffer.from(stateData.state).equals(Buffer.from(stateParam)));
  if (!stateMatches) return redirectWithError(siteUrl, "state_invalid");
  const error = request.nextUrl.searchParams.get("error");
  if (error) return redirectWithError(siteUrl, "consent_denied");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectWithError(siteUrl, "code_missing");

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: stateData.verifier!,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({})) as {
      access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string;
    };
    if (!response.ok || typeof data.access_token !== "string") return redirectWithError(siteUrl, "token_exchange_failed");
    const previousValue = request.cookies.get("meai_google_session")?.value;
    const previous = previousValue ? decryptGoogleSession(previousValue) : null;
    const session: GoogleSession = {
      access_token: data.access_token,
      ...(data.refresh_token || previous?.refresh_token ? { refresh_token: data.refresh_token || previous?.refresh_token } : {}),
      expires_at: Date.now() + Math.max(60, data.expires_in || 3600) * 1000,
      ...(data.scope ? { scope: data.scope } : {}),
    };
    const result = NextResponse.redirect(new URL("/?google=connected", siteUrl));
    result.cookies.set("meai_google_oauth_state", "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/api/integrations/google/callback", maxAge: 0,
    });
    setGoogleSessionCookie(result, encryptGoogleSession(session));
    return result;
  } catch {
    return redirectWithError(siteUrl, "token_exchange_unavailable");
  }
}
