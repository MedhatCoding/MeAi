import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let prompt = "";
  let aspect = "1:1";
  try {
    const body = await request.json() as { prompt?: unknown; aspect?: unknown; style?: unknown };
    if (typeof body.prompt !== "string") return Response.json({ error: "اكتب وصف الصورة." }, { status: 400 });
    prompt = body.prompt.replace(/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]/g, " ").trim();
    if (prompt.length < 4 || prompt.length > 1800) return Response.json({ error: "الوصف يجب أن يكون بين 4 و1800 حرف." }, { status: 400 });
    if (body.aspect === "16:9" || body.aspect === "9:16") aspect = body.aspect;
    const style = typeof body.style === "string" ? body.style.slice(0, 40) : "";
    if (style) prompt += "\\nArt direction: " + style;
  } catch { return Response.json({ error: "تعذر قراءة الطلب." }, { status: 400 }); }

  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) return Response.json({ error: "توليد الصور يحتاج CLOUDFLARE_ACCOUNT_ID وCLOUDFLARE_API_TOKEN." }, { status: 503 });
  // Model input uses dimensions close to the selected aspect ratio.
  const dimensions = aspect === "16:9" ? { width: 1024, height: 576 } : aspect === "9:16" ? { width: 576, height: 1024 } : { width: 768, height: 768 };
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
  try {
    const upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...dimensions }), cache: "no-store", signal: AbortSignal.timeout(90000),
    });
    if (!upstream.ok) return Response.json({ error: `تعذر توليد الصورة لدى Cloudflare (رمز ${upstream.status}). تحقق من إتاحة النموذج ورصيد الحساب.` }, { status: 502 });
    const contentType = upstream.headers.get("content-type") || "";
    let bytes: Uint8Array;
    let mime = "image/png";
    if (contentType.includes("application/json")) {
      const payload = await upstream.json() as { result?: { image?: unknown } };
      if (typeof payload.result?.image !== "string") return Response.json({ error: "المزوّد لم يُرجع صورة قابلة للعرض." }, { status: 502 });
      const raw = payload.result.image.replace(/^data:image\\/[^;]+;base64,/, "");
      bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    } else {
      mime = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/png";
      bytes = new Uint8Array(await upstream.arrayBuffer());
    }
    if (!bytes.length || bytes.length > 12_000_000) return Response.json({ error: "حجم الصورة غير صالح أو يتجاوز الحد." }, { status: 502 });
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const image = `data:${mime};base64,${btoa(binary)}`;
    return Response.json({ image, mime, model, createdAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة توليد الصورة أو تعذر الاتصال." }, { status: 504 });
  }
}
