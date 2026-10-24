import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let messages: ChatMessage[];
  try {
    const body = await request.json() as { messages?: ChatMessage[] };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError("أرسل رسالة واحدة على الأقل.", 400);
    }
    messages = body.messages.filter((m) =>
      m && ["system", "user", "assistant"].includes(m.role) &&
      typeof m.content === "string" && m.content.length <= 100_000
    );
    if (!messages.length) return jsonError("صيغة الرسائل غير صحيحة.", 400);
  } catch {
    return jsonError("تعذر قراءة الطلب.", 400);
  }

  // Preferred: Cloudflare Workers AI OpenAI-compatible Chat Completions API.
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflareModel = process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const openAiBase = process.env.OPENAI_BASE_URL;
  const openAiKey = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL;

  let endpoint = "";
  let token = "";
  let model = "";
  if (accountId && cloudflareToken) {
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    token = cloudflareToken;
    model = cloudflareModel;
  } else if (openAiBase && openAiKey && openAiModel) {
    endpoint = `${openAiBase.replace(/\/+$/, "")}/chat/completions`;
    token = openAiKey;
    model = openAiModel;
  } else {
    return jsonError("خدمة الذكاء الاصطناعي غير مهيأة. أضف أسرار Cloudflare أو مزوّدًا متوافقًا مع OpenAI إلى إعدادات الاستضافة.", 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.6 }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return jsonError("تعذر الاتصال بمزوّد الذكاء الاصطناعي. تحقق من الاتصال والإعدادات.", 502);
  }
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 700);
    return jsonError(`فشل المزوّد (${upstream.status}): ${detail}`, 502);
  }
  if (!upstream.body) return jsonError("المزوّد لم يُرجع تدفقًا للرد.", 502);

  // Forward SSE directly so the browser can render tokens as they arrive.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
