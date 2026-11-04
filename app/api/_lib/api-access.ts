import { NextRequest } from "next/server";
import { requireAllowedAccount } from "./allowed-account";

/**
 * Decide whether AI-cost endpoints require an authenticated, allowlisted account.
 * Explicit env wins. By default the gate activates automatically as soon as
 * MEAI_AGENT_ALLOWED_EMAILS is configured, so the same deployment that trusts an
 * allowlist for GitHub edits is not left with fully open AI endpoints.
 */
export function apiAuthRequired(): boolean {
  const explicit = process.env.MEAI_REQUIRE_AUTH;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return Boolean((process.env.MEAI_AGENT_ALLOWED_EMAILS || "").trim());
}

/**
 * Returns a 403 response when the gate is active and the caller is not a
 * confirmed, allowlisted account; otherwise null to continue.
 */
export async function enforceApiAccess(request: NextRequest): Promise<Response | null> {
  if (!apiAuthRequired()) return null;
  const account = await requireAllowedAccount(request);
  if (!account) {
    return Response.json(
      { error: "هذه الخدمة مقيّدة. سجّل الدخول بحساب مؤكّد ومصرح به لاستخدامها." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
