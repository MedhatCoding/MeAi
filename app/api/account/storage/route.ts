import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "meai-files";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function objectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}
async function authenticate(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\\s+(.+)$/i);
  if (!base || !anonKey || !match) return null;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown };
    return typeof user.id === "string" ? { base, anonKey, token: match[1], userId: user.id } : null;
  } catch { return null; }
}
function headers(session: NonNullable<Awaited<ReturnType<typeof authenticate>>>) {
  return { apikey: session.anonKey, Authorization: `Bearer ${session.token}` };
}

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "storage-list", 60);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("سجّل الدخول أولًا لعرض ملفاتك السحابية.", 401);
  try {
    const url = new URL(`${session.base}/rest/v1/workspace_files`);
    url.searchParams.set("select", "id,name,mime_type,storage_path,size_bytes,created_at");
    url.searchParams.set("user_id", `eq.${session.userId}`);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "200");
    const response = await fetch(url, { headers: { ...headers(session), Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return fail("تعذر تحميل قائمة الملفات من قاعدة البيانات.", 502);
    const files = await response.json();
    return Response.json({ ok: true, files }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("تعذر الاتصال بمخزن الملفات.", 502); }
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "storage-action", 90);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8000) return fail("بيانات الطلب أكبر من الحد المسموح.", 413);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch { return fail("صيغة الطلب غير صالحة.", 400); }

  if (body.action === "register") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 255) : "";
    const path = typeof body.path === "string" ? body.path : "";
    const mime = typeof body.mimeType === "string" ? body.mimeType.slice(0, 160) : "application/octet-stream";
    const size = Number(body.size);
    if (!name || !path.startsWith(`${session.userId}/`) || path.includes("..") || !Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_SIZE) {
      return fail("بيانات الملف غير صالحة أو لا تخص حسابك.", 400);
    }
    try {
      const response = await fetch(`${session.base}/rest/v1/workspace_files`, {
        method: "POST",
        headers: { ...headers(session), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ user_id: session.userId, name, mime_type: mime, storage_path: path, size_bytes: size }),
        cache: "no-store",
      });
      if (!response.ok) return fail("تم رفع الملف لكن تعذر تسجيل بياناته. حدّث قائمة الملفات أو أعد المحاولة.", 502);
      const rows = await response.json();
      return Response.json({ ok: true, file: rows[0] }, { headers: { "Cache-Control": "no-store" } });
    } catch { return fail("تم رفع الملف لكن تعذر تسجيل بياناته.", 502); }
  }

  if (body.action === "download") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`${session.userId}/`) || path.includes("..")) return fail("مسار الملف غير صالح.", 400);
    try {
      const response = await fetch(`${session.base}/storage/v1/object/sign/${BUCKET}/${objectPath(path)}`, {
        method: "POST",
        headers: { ...headers(session), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 3600 }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({})) as { signedURL?: string; error?: string; message?: string };
      if (!response.ok || !data.signedURL) return fail("تعذر إنشاء رابط تنزيل آمن لهذا الملف.", 502);
      const signedUrl = data.signedURL.startsWith("http") ? data.signedURL : `${session.base}/storage/v1${data.signedURL.startsWith("/") ? "" : "/"}${data.signedURL}`;
      return Response.json({ ok: true, url: signedUrl }, { headers: { "Cache-Control": "no-store" } });
    } catch { return fail("تعذر إنشاء رابط التنزيل.", 502); }
  }
  return fail("العملية المطلوبة غير مدعومة.", 400);
}

export async function DELETE(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "storage-delete", 20);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("سجّل الدخول أولًا.", 401);
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return fail("صيغة الطلب غير صالحة.", 400); }
  if (typeof body.id !== "string" || body.id.length > 80) return fail("معرّف الملف غير صالح.", 400);
  try {
    const query = new URL(`${session.base}/rest/v1/workspace_files`);
    query.searchParams.set("select", "id,storage_path");
    query.searchParams.set("id", `eq.${body.id}`);
    query.searchParams.set("user_id", `eq.${session.userId}`);
    query.searchParams.set("limit", "1");
    const found = await fetch(query, { headers: { ...headers(session), Accept: "application/json" }, cache: "no-store" });
    if (!found.ok) return fail("تعذر التحقق من ملكية الملف.", 502);
    const rows = await found.json() as { id: string; storage_path: string | null }[];
    if (!rows[0]) return fail("الملف غير موجود أو لا تملك صلاحية حذفه.", 404);
    const path = rows[0].storage_path;
    if (path) {
      const removed = await fetch(`${session.base}/storage/v1/object/${BUCKET}/${objectPath(path)}`, {
        method: "DELETE", headers: headers(session), cache: "no-store",
      });
      if (!removed.ok && removed.status !== 404) return fail("تعذر حذف الملف من التخزين.", 502);
    }
    const deleted = await fetch(query, { method: "DELETE", headers: { ...headers(session), Prefer: "return=minimal" }, cache: "no-store" });
    if (!deleted.ok) return fail("تعذر حذف سجل الملف.", 502);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("حدث خطأ أثناء حذف الملف.", 502); }
}
