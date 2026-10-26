import type { NextRequest } from "next/server";

const buckets = new Map<string, { start: number; count: number }>();

export function rejectCrossOrigin(request: NextRequest): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return Response.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  }
  return null;
}

/** Best-effort per-instance limit. Configure shared edge rate limiting for multi-instance deployments. */
export function enforceRateLimit(request: NextRequest, namespace: string, max = 20): Response | null {
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = namespace + ":" + ip;
  const now = Date.now();
  for (const [id, bucket] of buckets) if (now - bucket.start >= 60_000) buckets.delete(id);
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= 60_000) {
    buckets.set(key, { start: now, count: 1 });
    return null;
  }
  bucket.count++;
  if (bucket.count <= max) return null;
  return Response.json({ error: "طلبات كثيرة خلال وقت قصير. استنى دقيقة وحاول تاني." }, {
    status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
  });
}
