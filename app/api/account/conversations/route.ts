import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CloudMessage = {
  role: "user" | "assistant";
  content: string;
  time: string;
  sources?: unknown;
  image?: string;
  tools?: unknown;
  trace?: unknown;
};
type CloudConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: CloudMessage[];
};

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
async function authenticate(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
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
function authHeaders(session: NonNullable<Awaited<ReturnType<typeof authenticate>>>) {
  return { apikey: session.anonKey, Authorization: `Bearer ${session.token}` };
}
function validConversation(value: unknown): value is CloudConversation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id || item.id.length > 120) return false;
  if (typeof item.title !== "string" || item.title.length > 180) return false;
  if (typeof item.updatedAt !== "string" || item.updatedAt.length > 64) return false;
  if (!Array.isArray(item.messages) || item.messages.length > 250) return false;
  return item.messages.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const message = entry as Record<string, unknown>;
    return (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.length <= 30000 &&
      typeof message.time === "string" && message.time.length <= 100;
  });
}

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "conversation-cloud-read", 30);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);

  try {
    const conversationsUrl = new URL(`${session.base}/rest/v1/conversations`);
    conversationsUrl.searchParams.set("select", "id,title,updated_at,metadata");
    conversationsUrl.searchParams.set("user_id", `eq.${session.userId}`);
    conversationsUrl.searchParams.set("order", "updated_at.desc");
    conversationsUrl.searchParams.set("limit", "60");
    const conversationsResponse = await fetch(conversationsUrl, {
      headers: { ...authHeaders(session), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!conversationsResponse.ok) return fail("تعذر تحميل المحادثات من قاعدة البيانات. تحقق من صلاحيات جدول المحادثات.", 502);
    const conversationRows = await conversationsResponse.json() as {
      id: string; title: string; updated_at: string; metadata?: Record<string, unknown> | null;
    }[];
    if (!conversationRows.length) return Response.json({ ok: true, conversations: [] }, { headers: { "Cache-Control": "no-store" } });

    const ids = conversationRows.map((item) => item.id);
    const messagesUrl = new URL(`${session.base}/rest/v1/messages`);
    messagesUrl.searchParams.set("select", "id,conversation_id,role,content,metadata,created_at");
    messagesUrl.searchParams.set("user_id", `eq.${session.userId}`);
    messagesUrl.searchParams.set("conversation_id", `in.(${ids.join(",")})`);
    messagesUrl.searchParams.set("order", "created_at.asc");
    messagesUrl.searchParams.set("limit", "15000");
    const messagesResponse = await fetch(messagesUrl, {
      headers: { ...authHeaders(session), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!messagesResponse.ok) return fail("تم العثور على المحادثات لكن تعذر تحميل رسائلها.", 502);
    const messageRows = await messagesResponse.json() as {
      conversation_id: string; role: string; content: string; metadata?: Record<string, unknown> | null; created_at: string;
    }[];
    const grouped = new Map<string, CloudMessage[]>();
    for (const row of messageRows) {
      if (row.role !== "user" && row.role !== "assistant") continue;
      const metadata = row.metadata || {};
      const list = grouped.get(row.conversation_id) || [];
      list.push({
        role: row.role,
        content: row.content,
        time: typeof metadata.time === "string" ? metadata.time : row.created_at,
        ...(Array.isArray(metadata.sources) ? { sources: metadata.sources } : {}),
        ...(typeof metadata.image === "string" ? { image: metadata.image } : {}),
        ...(Array.isArray(metadata.tools) ? { tools: metadata.tools } : {}),
        ...(Array.isArray(metadata.trace) ? { trace: metadata.trace } : {}),
      });
      grouped.set(row.conversation_id, list);
    }
    const result = conversationRows.map((row) => ({
      id: typeof row.metadata?.client_id === "string" ? row.metadata.client_id : row.id,
      title: row.title || "",
      updatedAt: row.updated_at,
      messages: grouped.get(row.id) || [],
    }));
    return Response.json({ ok: true, conversations: result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("تعذر الاتصال بقاعدة البيانات أثناء تحميل المحادثات.", 502);
  }
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "conversation-cloud-write", 40);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);

  let conversation: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) return fail("حجم المحادثة أكبر من حد المزامنة (2MB).", 413);
    const body = JSON.parse(raw) as { conversation?: unknown };
    if (!validConversation(body.conversation)) return fail("بيانات المحادثة غير صالحة أو تتجاوز الحدود المسموحة.", 400);
    conversation = body.conversation;
  } catch { return fail("تعذر قراءة بيانات المحادثة.", 400); }

  const item = conversation as CloudConversation;
  const headers = authHeaders(session);
  try {
    const lookup = new URL(`${session.base}/rest/v1/conversations`);
    lookup.searchParams.set("select", "id");
    lookup.searchParams.set("user_id", `eq.${session.userId}`);
    lookup.searchParams.set("metadata->>client_id", `eq.${item.id}`);
    lookup.searchParams.set("limit", "1");
    const found = await fetch(lookup, { headers: { ...headers, Accept: "application/json" }, cache: "no-store" });
    if (!found.ok) return fail("تعذر التحقق من المحادثة الحالية في حسابك.", 502);
    const foundRows = await found.json() as { id: string }[];
    let conversationId = foundRows[0]?.id;

    const record = {
      user_id: session.userId,
      title: item.title.slice(0, 180) || "محادثة جديدة",
      updated_at: item.updatedAt,
      metadata: { client_id: item.id, sync_version: 1 },
    };
    if (conversationId) {
      const updateUrl = new URL(`${session.base}/rest/v1/conversations`);
      updateUrl.searchParams.set("id", `eq.${conversationId}`);
      updateUrl.searchParams.set("user_id", `eq.${session.userId}`);
      const updated = await fetch(updateUrl, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ title: record.title, updated_at: record.updated_at, metadata: record.metadata }),
        cache: "no-store",
      });
      if (!updated.ok) return fail("تعذر تحديث بيانات المحادثة.", 502);
    } else {
      const created = await fetch(`${session.base}/rest/v1/conversations`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(record),
        cache: "no-store",
      });
      if (!created.ok) return fail("تعذر إنشاء سجل المحادثة في قاعدة البيانات.", 502);
      const createdRows = await created.json() as { id: string }[];
      conversationId = createdRows[0]?.id;
      if (!conversationId) return fail("لم تُرجع قاعدة البيانات معرّف المحادثة الجديدة.", 502);
    }

    const oldMessagesUrl = new URL(`${session.base}/rest/v1/messages`);
    oldMessagesUrl.searchParams.set("select", "id");
    oldMessagesUrl.searchParams.set("conversation_id", `eq.${conversationId}`);
    oldMessagesUrl.searchParams.set("user_id", `eq.${session.userId}`);
    const oldResponse = await fetch(oldMessagesUrl, {
      headers: { ...headers, Accept: "application/json" }, cache: "no-store",
    });
    if (!oldResponse.ok) return fail("تعذر تجهيز تحديث رسائل المحادثة.", 502);
    const oldRows = await oldResponse.json() as { id: string }[];

    const rows = item.messages.map((message, index) => {
      const metadata: Record<string, unknown> = { time: message.time };
      if (Array.isArray(message.sources)) metadata.sources = message.sources;
      if (typeof message.image === "string") metadata.image = message.image;
      if (Array.isArray(message.tools)) metadata.tools = message.tools;
      if (Array.isArray(message.trace)) metadata.trace = message.trace;
      return {
        conversation_id: conversationId,
        user_id: session.userId,
        role: message.role,
        content: message.content,
        attachments: [],
        metadata,
        created_at: new Date(Date.now() + index).toISOString(),
      };
    });

    if (rows.length) {
      const inserted = await fetch(`${session.base}/rest/v1/messages`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(rows),
        cache: "no-store",
      });
      if (!inserted.ok) return fail("تعذر حفظ رسائل المحادثة. احتفظنا بالرسائل القديمة وحاول المزامنة مرة أخرى.", 502);
    }

    if (oldRows.length) {
      const deleteUrl = new URL(`${session.base}/rest/v1/messages`);
      deleteUrl.searchParams.set("conversation_id", `eq.${conversationId}`);
      deleteUrl.searchParams.set("user_id", `eq.${session.userId}`);
      deleteUrl.searchParams.set("id", `in.(${oldRows.map((row) => row.id).join(",")})`);
      const removed = await fetch(deleteUrl, {
        method: "DELETE", headers: { ...headers, Prefer: "return=minimal" }, cache: "no-store",
      });
      if (!removed.ok) return fail("تم حفظ الرسائل الجديدة، لكن تعذر تنظيف النسخة السابقة؛ ستتم معالجة التكرار في المزامنة التالية.", 502);
    }
    return Response.json({ ok: true, savedMessages: rows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("تعذر الاتصال بقاعدة البيانات أثناء حفظ المحادثة.", 502);
  }
}

export async function DELETE(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "conversation-cloud-delete", 20);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("انتهت جلسة الحساب أو لم تسجّل الدخول.", 401);
  let clientId = "";
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4000) return fail("حجم الطلب أكبر من الحد المسموح.", 413);
    const body = JSON.parse(raw) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id || body.id.length > 120) return fail("معرّف المحادثة غير صالح.", 400);
    clientId = body.id;
  } catch { return fail("صيغة طلب الحذف غير صالحة.", 400); }
  try {
    const headers = authHeaders(session);
    const lookup = new URL(`${session.base}/rest/v1/conversations`);
    lookup.searchParams.set("select", "id");
    lookup.searchParams.set("user_id", `eq.${session.userId}`);
    lookup.searchParams.set("metadata->>client_id", `eq.${clientId}`);
    lookup.searchParams.set("limit", "1");
    const found = await fetch(lookup, { headers: { ...headers, Accept: "application/json" }, cache: "no-store" });
    if (!found.ok) return fail("تعذر التحقق من ملكية المحادثة قبل حذفها.", 502);
    const rows = await found.json() as { id: string }[];
    if (!rows[0]) return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    const remove = new URL(`${session.base}/rest/v1/conversations`);
    remove.searchParams.set("id", `eq.${rows[0].id}`);
    remove.searchParams.set("user_id", `eq.${session.userId}`);
    const deleted = await fetch(remove, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" }, cache: "no-store" });
    if (!deleted.ok) return fail("تعذر حذف المحادثة من السحابة.", 502);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("حدث خطأ أثناء حذف المحادثة السحابية.", 502); }
}
