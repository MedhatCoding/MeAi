import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export type GoogleSession = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
};

function key() {
  const secret = process.env.MEAI_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("MEAI_SESSION_SECRET must be at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleSession(session: GoogleSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptGoogleSession(value: string): GoogleSession | null {
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const parsed = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as Partial<GoogleSession>;
    if (typeof parsed.access_token !== "string" || typeof parsed.expires_at !== "number") return null;
    return parsed as GoogleSession;
  } catch {
    return null;
  }
}

export async function getGoogleAccess(request: NextRequest): Promise<{ session: GoogleSession; cookie?: string } | null> {
  const value = request.cookies.get("meai_google_session")?.value;
  if (!value) return null;
  let session = decryptGoogleSession(value);
  if (!session) return null;
  if (session.expires_at > Date.now() + 60_000) return { session };
  if (!session.refresh_token || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: session.refresh_token,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { access_token?: string; expires_in?: number; scope?: string };
    if (typeof data.access_token !== "string") return null;
    session = {
      ...session,
      access_token: data.access_token,
      expires_at: Date.now() + Math.max(60, data.expires_in || 3600) * 1000,
      ...(data.scope ? { scope: data.scope } : {}),
    };
    return { session, cookie: encryptGoogleSession(session) };
  } catch {
    return null;
  }
}

export function setGoogleSessionCookie(response: NextResponse, value: string, maxAge = 60 * 60 * 24 * 30) {
  response.cookies.set("meai_google_session", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge,
  });
}
