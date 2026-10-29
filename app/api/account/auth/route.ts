import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "account-auth", 8);
  if (rateError) return rateError;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anonKey) return fail("تسجيل الدخول السحابي غير مهيأ؛ أضف إعدادات Supabase إلى الخادم.", 503);

  let action: "login" | "signup", email: string, password: string;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return fail("حجم الطلب أكبر من الحد المسموح.", 413);
    const body = JSON.parse(raw) as { action?: unknown; email?: unknown; password?: unknown };
    if (body.action !== "login" && body.action !== "signup") return fail("نوع عملية الحساب غير صالح.", 400);
    if (typeof body.email !== "string" || typeof body.password !== "string") return fail("أدخل البريد الإلكتروني وكلمة المرور.", 400);
    action = body.action;
    email = body.email.trim().toLowerCase();
    password = body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail("صيغة البريد الإلكتروني غير صحيحة.", 400);
    if (password.length < 8 || password.length > 256) return fail("كلمة المرور يجب أن تكون بين 8 و256 حرفًا.", 400);
  } catch { return fail("تعذر قراءة بيانات الحساب.", 400); }

  try {
    const url = action === "signup" ? `${base}/auth/v1/signup` : `${base}/auth/v1/token?grant_type=password`;
    const response = await fetch(url, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({})) as {
      access_token?: string; refresh_token?: string; token_type?: string; expires_in?: number;
      user?: { id?: string; email?: string; email_confirmed_at?: string | null };
      msg?: string; message?: string; error_description?: string; error?: string;
    };
    if (!response.ok) {
      const rawError = data.msg || data.message || data.error_description || data.error || "";
      const safeMessage = /invalid login credentials/i.test(rawError) ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : /already registered|already exists/i.test(rawError) ? "هذا البريد مسجل بالفعل؛ جرّب تسجيل الدخول."
        : /email not confirmed/i.test(rawError) ? "أكد بريدك الإلكتروني من رسالة Supabase ثم سجّل الدخول."
        : action === "signup" ? "تعذر إنشاء الحساب. راجع البريد الإلكتروني وإعدادات تأكيد البريد في Supabase."
        : "تعذر تسجيل الدخول. راجع البيانات وحالة حسابك.";
      return fail(safeMessage, response.status === 429 ? 429 : 400);
    }
    if (!data.access_token || !data.user?.id) {
      return Response.json({ ok: true, needsEmailConfirmation: true, message: "تم إرسال رسالة تأكيد إذا كان تأكيد البريد مطلوبًا. أكّد بريدك ثم سجّل الدخول." }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({
      ok: true,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token || "",
        expires_in: data.expires_in || 3600,
        user: { id: data.user.id, email: data.user.email || email },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("تعذر الاتصال بخدمة حسابات Supabase.", 502);
  }
}
