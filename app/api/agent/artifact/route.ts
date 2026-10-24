import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let task = "";
  let format = "markdown";
  try {
    const body = await request.json() as { task?: unknown; format?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) return fail("اكتب وصف الملف المطلوب.", 400);
    task = body.task.trim();
    if (task.length > 6000) return fail("وصف المهمة طويل جدًا؛ الحد الأقصى 6000 حرف.", 413);
    if (body.format === "typescript" || body.format === "javascript" || body.format === "json" || body.format === "markdown" || body.format === "python" || body.format === "text") format = body.format;
  } catch { return fail("تعذر قراءة الطلب.", 400); }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const base = process.env.OPENAI_BASE_URL;
  const key = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL;
  let endpoint = "";
  let token = "";
  let model = "";
  if (accountId && cloudflareToken) {
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    token = cloudflareToken;
    model = process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  } else if (base && key && openAiModel) {
    endpoint = `${base.replace(/\/+$/, "")}/chat/completions`;
    token = key; model = openAiModel;
  } else return fail("خدمة الذكاء الاصطناعي غير مهيأة.", 503);

  const system = `أنت مساعد برمجة ينشئ مسودة ملف واحدة فقط لحفظها في مساحة عمل محلية بالمتصفح. لا تنفذ أي كود ولا تدّعِ اختباره. أعد JSON صالحًا فقط: {"filename":"اسم مناسب بامتداد .${format === "typescript" ? "ts" : format === "javascript" ? "js" : format === "json" ? "json" : format === "python" ? "py" : format === "markdown" ? "md" : "txt"}","content":"محتوى الملف كنص","summary":"وصف قصير بالعربية"}. التنسيق المطلوب: ${format}. لا تستخدم مسارات أو شرطات مائلة في filename، ولا تضع أسرارًا أو مفاتيح API. اجعل الملف مفيدًا ومكتملًا بقدر الإمكان. الحد الأقصى للمحتوى 12000 حرف.`;
  let response: Response;
  try {
    response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: task }], stream: false, temperature: 0.2 }), signal: request.signal, cache: "no-store" });
  } catch { return fail("تعذر الاتصال بمزوّد الذكاء الاصطناعي.", 502); }
  if (!response.ok) return fail(`فشل المزوّد (${response.status}).`, 502);
  try {
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return fail("المزوّد لم يُرجع محتوى نصيًا.", 502);
    const clean = raw.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/, "");
    const data = JSON.parse(clean) as { filename?: unknown; content?: unknown; summary?: unknown };
    if (typeof data.filename !== "string" || typeof data.content !== "string" || typeof data.summary !== "string") return fail("صيغة الملف الناتج غير صالحة.", 502);
    const filename = data.filename.trim();
    if (!/^[\p{L}\p{N}._-]{1,80}$/u.test(filename) || filename.startsWith(".") || filename.includes("..")) return fail("اسم الملف الناتج غير آمن.", 502);
    if (data.content.length > 12000) return fail("الملف الناتج أكبر من الحد المسموح.", 502);
    return Response.json({ artifact: { filename, content: data.content, summary: data.summary.slice(0, 300), format } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("تعذر تحليل الملف الناتج؛ حاول بصياغة أبسط.", 502); }
}
