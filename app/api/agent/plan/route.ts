import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";
import { enforceApiAccess } from "../../_lib/api-access";
import { NextRequest } from "next/server";
import { getModelConfig, fetchModelWithFallback } from "../../_lib/model-config";

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
  const accessError = await enforceApiAccess(request);
  if (accessError) return accessError;
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

  const modelConfig = getModelConfig();
  if (!modelConfig) return error("خدمة الذكاء الاصطناعي غير مهيأة. أضف أسرار المزوّد في إعدادات الاستضافة.", 503);
  const { model } = modelConfig;

  const system = `أنت مخطط مهام لمساعد عام يدعم البحث والتجارب التقنية والأمن السيبراني. لا تدّع أنك نفّذت أي شيء. أعد JSON صالحًا فقط دون Markdown بالشكل:
{"summary":"ملخص قصير بالعربية","steps":["خطوة واضحة","خطوة واضحة"],"limitations":["حد أو تحذير"]}
اكتب من 2 إلى 10 خطوات قابلة للتحقق، بالعربية، بحسب تعقيد المهمة دون حشو. عند المهام الأمنية، ضمّن خطوات إعداد مختبر محلي معزول، وتحديد نطاق الاختبار، واستخدام أهداف وبيانات تجريبية، والتحقق من النتائج. لا ترفض التخطيط لمهمة لمجرد أنها تتضمن نشرًا أو شراءً أو إرسال رسالة؛ وضّح أن هذه الإجراءات الخارجية تحتاج تأكيدًا صريحًا قبل تنفيذها. لا تقترح إتلاف بيانات أو تجاوز صلاحيات أو كشف أسرار. لا ترفض التخطيط لمجرد أن المهمة تتناول ثغرات أو برمجيات خبيثة أو اختبار اختراق؛ فرّق بين الدراسة والتحليل داخل المختبر وبين استهداف أنظمة حقيقية دون تصريح. إذا كانت المهمة غامضة فاذكر الافتراضات أو اطلب توضيحًا واحدًا ضروريًا. لا تقل إن التنفيذ غير متاح عمومًا؛ اذكر فقط القدرات المتاحة فعلًا في التطبيق وأي اعتماد خارجي ناقص.`;
  let response: Response;
  try {
    response = await fetchModelWithFallback(modelConfig, {
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
    const steps = parsed.steps.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean).slice(0, 10);
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
