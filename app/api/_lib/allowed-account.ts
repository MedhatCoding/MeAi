import { NextRequest } from "next/server";

export type AuthorizedAccount = { id: string; email: string };

export async function requireAllowedAccount(request: NextRequest): Promise<AuthorizedAccount | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const allowlist = (process.env.MEAI_AGENT_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!base || !anonKey || !allowlist.length || !match) return null;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown; email?: unknown; email_confirmed_at?: unknown };
    if (typeof user.id !== "string" || typeof user.email !== "string" || !user.email_confirmed_at) return null;
    const email = user.email.toLowerCase();
    if (!allowlist.includes(email)) return null;
    return { id: user.id, email };
  } catch {
    return null;
  }
}
