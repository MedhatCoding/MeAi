import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 24_000) return error("حجم الطلب أكبر من الحد المسموح.", 413);
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "agent-plan", 12);
  if (rateError) return rateError;
  let task = "";
  try {
    const body = await request.json() as { task?: unknown };
    if (typeof body.task !== "string") return error("اكتب وصف المهمة أولًا.", 400);
    task = body.task.trim();
    if (!task) return error("اكتب وصف المهمة أولًا.", 400);
    if (task.length > 6000) return error("وصف المهمة طويل جدًا؛ الحد الأقصى 6000 حرف.", 413);
  } catch {
    return error("تعذر قراءة الطلب.", 400);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflareModel = process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const base = process.env.OPENAI_BASE_URL;
  const key = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL;
  let endpoint = "";
  let token = "";
  let model = "";
  if (accountId && cloudflareToken) {
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    token = cloudflareToken; model = cloudflareModel;
  } else if (base && key && openAiModel) {
    endpoint = `${base.replace(/\/+$/, "")}/chat/completions`;
    token = key; model = openAiModel;
  } else {
    return error("خدمة الذكاء الاصطناعي غير مهيأة. أضف أسرار المزوّد في إعدادات الاستضافة.", 503);
  }

  const system = `أنت مخطط مهام آمن لمساعد شخصي. لا تدّع أنك نفّذت أي شيء. أعد JSON صالحًا فقط دون Markdown بالشكل:
{"summary":"ملخص قصير بالعربية","steps":["خطوة واضحة","خطوة واضحة"],"limitations":["حد أو تحذير"]}
اكتب من 3 إلى 6 خطوات قابلة للتحقق، بالعربية. لا تقترح أوامر نظام مدمرة، أو نشرًا، أو شراءً، أو إرسال رسائل دون موافقة. إذا كانت المهمة غامضة فاجعل أول خطوة تحديد المتطلبات. اذكر أن التنفيذ الفعلي غير متاح عبر هذه الواجهة في limitations.`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: task }], stream: false, temperature: 0.2 }),
      signal: request.signal, cache: "no-store",
    });
  } catch {
    return error("تعذر الاتصال بمزوّد الذكاء الاصطناعي.", 502);
  }
  if (!response.ok) return error(`فشل المزوّد (${response.status}). تحقق من إعداداته.`, 502);
  let raw = "";
  try {
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const value = payload.choices?.[0]?.message?.content;
    if (typeof value !== "string") return error("المزوّد لم يُرجع خطة نصية.", 502);
    raw = value.trim();
    // Models sometimes wrap JSON in prose/fences or emit harmless trailing commas.
    const candidates = [raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")];
    const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
    let parsed: { summary?: unknown; steps?: unknown; limitations?: unknown } | null = null;
    for (const candidate of candidates) {
      try {
        const normalized = candidate.replace(/,\s*([}\]])/g, "$1");
        const value = JSON.parse(normalized) as unknown;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          parsed = value as { summary?: unknown; steps?: unknown; limitations?: unknown };
          break;
        }
      } catch { /* try the next bounded candidate */ }
    }
    if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.steps) ||
      !parsed.steps.every(x => typeof x === "string")) {
      return error("المزوّد أعاد خطة بتنسيق غير صالح. أعد المحاولة؛ لم يتم تنفيذ أي إجراء.", 502);
    }
    const steps = parsed.steps.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean).slice(0, 6);
    if (steps.length < 1) return error("الخطة لا تحتوي على خطوات قابلة للعرض. أعد المحاولة.", 502);
    const plan = {
      summary: parsed.summary.trim().slice(0, 300),
      steps: steps.map(x => x.slice(0, 500)),
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations.filter((x): x is string => typeof x === "string").slice(0, 5).map(x => x.slice(0, 400)) : ["هذه خطة فقط؛ التنفيذ الفعلي للملفات غير مفعّل في واجهة الويب."],
    };
    if (!plan.steps.length) return error("الخطة لا تحتوي على خطوات. جرّب طلبًا أكثر تحديدًا.", 502);
    return Response.json({ plan }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("تعذر تحليل الخطة التي أعادها المزوّد. حاول مرة أخرى.", 502);
  }
}
