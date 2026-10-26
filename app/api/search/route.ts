import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per-instance abuse guard. Use host-level/shared rate limiting for
// multi-instance deployments; this map intentionally stores no query contents.
const windows = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

function allowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients may omit Origin
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function isRateLimited(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  // Opportunistically discard expired entries to bound memory.
  for (const [id, entry] of windows) if (now - entry.start >= WINDOW_MS) windows.delete(id);
  const entry = windows.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  if (!allowedOrigin(request)) {
    return Response.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  if (isRateLimited(request)) {
    return Response.json({ error: "طلبات البحث كثيرة. انتظر دقيقة ثم حاول مجددًا." }, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 8_000) {
    return Response.json({ error: "حجم طلب البحث أكبر من المسموح." }, { status: 413 });
  }

  let query = "";
  try {
    const raw = await request.text();
    if (raw.length > 8_000) return Response.json({ error: "حجم طلب البحث أكبر من المسموح." }, { status: 413 });
    const body = JSON.parse(raw) as { query?: unknown };
    if (typeof body.query !== "string") return Response.json({ error: "اكتب عبارة البحث." }, { status: 400 });
    query = body.query.replace(/[\\x00-\\x1f\\x7f]/g, " ").replace(/\\s+/g, " ").trim();
    if (query.length < 2 || query.length > 300) {
      return Response.json({ error: "عبارة البحث يجب أن تكون بين حرفين و300 حرف." }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "تعذر قراءة الطلب." }, { status: 400 });
  }

  const key = process.env.SERPER_API_KEY;
  if (!key) return Response.json({ error: "البحث غير مهيأ. أضف SERPER_API_KEY إلى أسرار الاستضافة." }, { status: 503 });

  try {
    const upstream = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "eg", hl: "ar", num: 8 }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return Response.json({ error: "تعذر البحث لدى المزود (" + upstream.status + ")." }, { status: 502 });
    }
    const payload = await upstream.json() as {
      organic?: { title?: unknown; link?: unknown; snippet?: unknown; date?: unknown; position?: unknown }[];
    };
    const results = (Array.isArray(payload.organic) ? payload.organic : []).slice(0, 8).flatMap((r) => {
      if (typeof r.title !== "string" || typeof r.link !== "string") return [];
      try {
        const url = new URL(r.link);
        if (url.protocol !== "https:" && url.protocol !== "http:") return [];
        return [{
          title: r.title.slice(0, 300),
          url: url.toString(),
          snippet: typeof r.snippet === "string" ? r.snippet.slice(0, 1200) : "",
          date: typeof r.date === "string" ? r.date.slice(0, 100) : null,
          position: typeof r.position === "number" ? r.position : null,
        }];
      } catch { return []; }
    });
    return Response.json({
      query,
      results,
      source: "Google Search via Serper",
      fetchedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة البحث أو تعذر الاتصال." }, { status: 504 });
  }
}
