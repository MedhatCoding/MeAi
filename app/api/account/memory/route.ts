import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticate(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!base || !anonKey || !match) return null;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown; email?: unknown };
    return typeof user.id === "string" ? { base, anonKey, accessToken: match[1], userId: user.id } : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "cloud-memory-read", 30);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);
  try {
    const response = await fetch(`${session.base}/rest/v1/meai_user_memory?select=payload,updated_at&user_id=eq.${encodeURIComponent(session.userId)}&limit=1`, {
      headers: { apikey: session.anonKey, Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fail(response.status === 404 || response.status === 400 ? "جدول الذاكرة السحابية غير جاهز. نفّذ ملف SQL الموجود في supabase/migrations." : "تعذر تحميل الذاكرة السحابية؛ تحقق من سياسات RLS في Supabase.", 502);
    const rows = await response.json() as { payload?: unknown; updated_at?: string }[];
    return Response.json({ ok: true, payload: rows[0]?.payload ?? null, updatedAt: rows[0]?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("تعذر الاتصال بقاعدة البيانات السحابية.", 502); }
}

export async function PUT(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "cloud-memory-write", 15);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 120_000) return fail("البيانات أكبر من الحد المسموح للمزامنة (120KB).", 413);
    const body = JSON.parse(raw) as { payload?: unknown };
    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return fail("صيغة بيانات المزامنة غير صالحة.", 400);
    payload = body.payload;
  } catch { return fail("تعذر قراءة بيانات المزامنة.", 400); }

  try {
    const response = await fetch(`${session.base}/rest/v1/meai_user_memory?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ user_id: session.userId, payload, updated_at: new Date().toISOString() }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return fail(response.status === 404 || response.status === 400 ? "جدول الذاكرة السحابية غير جاهز. نفّذ ملف SQL الموجود في supabase/migrations." : "رفضت قاعدة البيانات حفظ الذاكرة؛ تحقق من سياسات RLS وصلاحيات الجدول.", 502);
    return Response.json({ ok: true, savedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("تعذر الاتصال بقاعدة البيانات السحابية.", 502); }
}
