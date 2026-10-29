import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";
import { getGoogleAccess, setGoogleSessionCookie } from "../../_lib/google-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const rateError = enforceRateLimit(request, "google-read", 20);
  if (rateError) return rateError;
  const view = request.nextUrl.searchParams.get("view");
  if (view !== "drive" && view !== "calendar" && view !== "status") return fail("حدد view=drive أو view=calendar أو view=status.", 400);
  const session = await getGoogleAccess(request);
  if (view === "status") {
    const response = NextResponse.json({ ok: true, connected: Boolean(session) }, { headers: { "Cache-Control": "no-store" } });
    if (session?.cookie) setGoogleSessionCookie(response, session.cookie);
    return response;
  }
  if (!session) return fail("Google غير مربوط أو انتهت صلاحيته. أعد ربط الحساب من الإعدادات.", 401);

  try {
    const url = view === "drive"
      ? "https://www.googleapis.com/drive/v3/files?pageSize=15&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)"
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=15&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(new Date().toISOString())}&fields=items(id,summary,description,start,end,htmlLink,status)`;
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${session.session.access_token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return fail(upstream.status === 401 || upstream.status === 403 ? "رفض Google الوصول. أعد ربط الحساب وراجع الأذونات التي وافقت عليها." : `فشل طلب Google (HTTP ${upstream.status}).`, upstream.status === 401 ? 401 : 502);
    const data = await upstream.json() as Record<string, unknown>;
    const result = view === "drive"
      ? { ok: true, view, files: Array.isArray(data.files) ? data.files : [] }
      : { ok: true, view, events: Array.isArray(data.items) ? data.items : [] };
    const response = NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    if (session.cookie) setGoogleSessionCookie(response, session.cookie);
    return response;
  } catch {
    return fail("تعذر الاتصال بخدمات Google حاليًا.", 502);
  }
}

export async function DELETE(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const response = NextResponse.json({ ok: true, message: "تم فصل Google عن هذا المتصفح." }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set("meai_google_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 0,
  });
  return response;
}
