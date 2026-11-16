import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "account-auth-refresh", 20);
  if (rateError) return rateError;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anonKey) return fail("تجديد جلسة الحساب غير مهيأ.", 503);

  let refreshToken = "";
  try {
    const raw = await request.text();
    if (raw.length > 5000) return fail("حجم الطلب أكبر من الحد المسموح.", 413);
    const body = JSON.parse(raw) as { refresh_token?: unknown };
    if (typeof body.refresh_token !== "string" || body.refresh_token.length < 20 || body.refresh_token.length > 4096) {
      return fail("رمز تجديد الجلسة غير صالح.", 400);
    }
    refreshToken = body.refresh_token;
  } catch {
    return fail("تعذر قراءة بيانات تجديد الجلسة.", 400);
  }

  try {
    const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({})) as {
      access_token?: string; refresh_token?: string; expires_in?: number;
      user?: { id?: string; email?: string };
    };
    if (!response.ok || !data.access_token || !data.refresh_token || !data.user?.id) {
      return fail("انتهت جلسة الحساب أو لم يعد رمز التجديد صالحًا. سجّل الدخول مرة أخرى.", 401);
    }
    return Response.json({
      ok: true,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
        user: { id: data.user.id, email: data.user.email || "" },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("تعذر الاتصال بخدمة تجديد جلسة Supabase.", 502);
  }
}
