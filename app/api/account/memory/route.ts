import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CloudMemoryPayload = {
  version: 1;
  messages?: { role: "user" | "assistant"; content: string; time: string }[];
  tasks?: { title: string; done: boolean }[];
  memories?: string[];
  documents?: { name: string; content: string; size: number; updatedAt: string }[];
  artifacts?: { filename: string; content: string; summary: string; createdAt: string }[];
};

function validatePayload(value: unknown): value is CloudMemoryPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  const allowed = new Set(["version", "messages", "tasks", "memories", "documents", "artifacts"]);
  if (Object.keys(p).some((key) => !allowed.has(key)) || p.version !== 1) return false;
  if (p.messages !== undefined && (!Array.isArray(p.messages) || p.messages.length > 30 ||
    p.messages.some((x) => !x || typeof x !== "object" || Array.isArray(x) ||
      !["user", "assistant"].includes(String((x as Record<string, unknown>).role)) ||
      typeof (x as Record<string, unknown>).content !== "string" || ((x as Record<string, unknown>).content as string).length > 1000 ||
      typeof (x as Record<string, unknown>).time !== "string" || ((x as Record<string, unknown>).time as string).length > 64))) return false;
  if (p.tasks !== undefined && (!Array.isArray(p.tasks) || p.tasks.length > 30 ||
    p.tasks.some((x) => !x || typeof x !== "object" || Array.isArray(x) ||
      typeof (x as Record<string, unknown>).title !== "string" || ((x as Record<string, unknown>).title as string).length > 180 ||
      typeof (x as Record<string, unknown>).done !== "boolean"))) return false;
  if (p.memories !== undefined && (!Array.isArray(p.memories) || p.memories.length > 30 ||
    p.memories.some((x) => typeof x !== "string" || x.length > 200))) return false;
  if (p.documents !== undefined && (!Array.isArray(p.documents) || p.documents.length > 5 ||
    p.documents.some((x) => !x || typeof x !== "object" || Array.isArray(x) ||
      typeof (x as Record<string, unknown>).name !== "string" || ((x as Record<string, unknown>).name as string).length > 120 ||
      typeof (x as Record<string, unknown>).content !== "string" || ((x as Record<string, unknown>).content as string).length > 2500 ||
      typeof (x as Record<string, unknown>).size !== "number" || !Number.isFinite((x as Record<string, unknown>).size) ||
      typeof (x as Record<string, unknown>).updatedAt !== "string" || ((x as Record<string, unknown>).updatedAt as string).length > 64))) return false;
  if (p.artifacts !== undefined && (!Array.isArray(p.artifacts) || p.artifacts.length > 3 ||
    p.artifacts.some((x) => !x || typeof x !== "object" || Array.isArray(x) ||
      typeof (x as Record<string, unknown>).filename !== "string" || ((x as Record<string, unknown>).filename as string).length > 180 ||
      typeof (x as Record<string, unknown>).content !== "string" || ((x as Record<string, unknown>).content as string).length > 3500 ||
      typeof (x as Record<string, unknown>).summary !== "string" || ((x as Record<string, unknown>).summary as string).length > 500 ||
      typeof (x as Record<string, unknown>).createdAt !== "string" || ((x as Record<string, unknown>).createdAt as string).length > 64))) return false;
  return true;
}

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
    if (Buffer.byteLength(raw, "utf8") > 120_000) return fail("البيانات أكبر من الحد المسموح للمزامنة (120KB).", 413);
    const body = JSON.parse(raw) as { payload?: unknown };
    if (!validatePayload(body.payload)) return fail("صيغة بيانات المزامنة غير صالحة أو تحتوي عناصر تتجاوز الحدود المسموحة.", 400);
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
