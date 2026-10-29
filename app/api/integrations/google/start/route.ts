import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.MEAI_GOOGLE_REDIRECT_URI;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.MEAI_SESSION_SECRET;
  if (!clientId || !redirectUri || !siteUrl || !secret || secret.length < 32) {
    return NextResponse.json({ error: "يلزم ضبط GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET وMEAI_GOOGLE_REDIRECT_URI وNEXT_PUBLIC_SITE_URL وMEAI_SESSION_SECRET (32 حرفًا على الأقل)." }, { status: 503 });
  }
  let callback: URL;
  try { callback = new URL(redirectUri); } catch { return NextResponse.json({ error: "عنوان إعادة توجيه Google غير صالح." }, { status: 500 }); }
  if (callback.pathname !== "/api/integrations/google/callback" || !["https:", "http:"].includes(callback.protocol)) {
    return NextResponse.json({ error: "MEAI_GOOGLE_REDIRECT_URI يجب أن يشير إلى مسار callback الخاص بالتطبيق." }, { status: 500 });
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("meai_google_oauth_state", Buffer.from(JSON.stringify({ state, verifier })).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google/callback",
    maxAge: 600,
  });
  return response;
}
