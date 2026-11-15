import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../_lib/guard";
import { enforceApiAccess } from "../_lib/api-access";
import { searchWeb } from "../_lib/web-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const accessError = await enforceApiAccess(request);
  if (accessError) return accessError;
  const rateError = enforceRateLimit(request, "search", 60);
  if (rateError) return rateError;

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64_000) {
    return Response.json({ error: "حجم طلب البحث أكبر من المسموح." }, { status: 413 });
  }

  let query = "";
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return Response.json({ error: "حجم طلب البحث أكبر من المسموح." }, { status: 413 });
    const body = JSON.parse(raw) as { query?: unknown };
    if (typeof body.query !== "string") return Response.json({ error: "اكتب عبارة البحث." }, { status: 400 });
    query = body.query.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
    if (query.length < 2 || query.length > 1000) {
      return Response.json({ error: "عبارة البحث يجب أن تكون بين حرفين و1000 حرف." }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "تعذر قراءة الطلب." }, { status: 400 });
  }

  try {
    const result = await searchWeb(query);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر البحث حاليًا.";
    const status = /غير مهيأ/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
