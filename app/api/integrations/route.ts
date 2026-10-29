import { rejectCrossOrigin } from "../_lib/guard";
import { getGoogleAccess, setGoogleSessionCookie } from "../_lib/google-session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Connector = {
  id: string;
  label: string;
  configured: boolean;
  connected: boolean;
  verified: boolean;
  mode: string;
  detail: string;
};

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const connectors: Connector[] = [];
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    connectors.push({ id: "github", label: "GitHub", configured: false, connected: false, verified: false, mode: "GitHub REST API", detail: "أضف GITHUB_TOKEN في أسرار الخادم." });
  } else {
    try {
      // Verify the token with a read-only authenticated identity request. Never expose the token.
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const user = await response.json() as { login?: unknown };
        const login = typeof user.login === "string" ? user.login : "حساب GitHub";
        const repo = (process.env.MEAI_GITHUB_REPOSITORY || "MedhatCoding/MeAi").trim();
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
          connectors.push({ id: "github", label: "GitHub", configured: true, connected: false, verified: true, mode: "GitHub REST API", detail: "الرمز صالح، لكن MEAI_GITHUB_REPOSITORY غير صالح." });
        } else {
          const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (repoResponse.ok) {
            const repository = await repoResponse.json() as { full_name?: string; html_url?: string; permissions?: { pull?: boolean; push?: boolean } };
            const permissions = repository.permissions;
            connectors.push({ id: "github", label: "GitHub", configured: true, connected: true, verified: true, mode: "GitHub REST API", detail: `تم التحقق من الهوية ${login} والوصول إلى المستودع ${repository.full_name || repo}. قراءة المستودع تعمل؛ صلاحية الكتابة: ${permissions?.push === true ? "متاحة حسب GitHub" : permissions?.push === false ? "غير متاحة" : "غير مؤكدة"}.` });
          } else {
            connectors.push({ id: "github", label: "GitHub", configured: true, connected: false, verified: true, mode: "GitHub REST API", detail: `الرمز صالح للهوية ${login}، لكن الوصول إلى المستودع ${repo} فشل (HTTP ${repoResponse.status}). تحقق من اسم المستودع وصلاحيات الرمز.` });
          }
        }
      } else {
        connectors.push({ id: "github", label: "GitHub", configured: true, connected: false, verified: true, mode: "GitHub REST API", detail: response.status === 401 ? "رمز GitHub غير صالح أو منتهي." : `تعذر التحقق من الرمز (HTTP ${response.status}).` });
      }
    } catch {
      connectors.push({ id: "github", label: "GitHub", configured: true, connected: false, verified: false, mode: "GitHub REST API", detail: "تعذر الوصول إلى GitHub للتحقق حاليًا." });
    }
  }

  const cloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const compatible = Boolean(process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [cloudflareResult, compatibleResult, supabaseResult] = await Promise.all([
    cloudflare ? (async () => {
      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/ai/models/search?search=${encodeURIComponent(process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct")}`, {
          headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return { ok: response.ok, status: response.status };
      } catch { return { ok: false, status: 0 }; }
    })() : Promise.resolve({ ok: false, status: -1 }),
    compatible ? (async () => {
      try {
        const base = process.env.OPENAI_BASE_URL!.trim().replace(/[/]+$/, "");
        const response = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return { ok: response.ok, status: response.status };
      } catch { return { ok: false, status: 0 }; }
    })() : Promise.resolve({ ok: false, status: -1 }),
    supabase ? (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/[/]+$/, "");
        const response = await fetch(`${base}/auth/v1/health`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return { ok: response.ok, status: response.status };
      } catch { return { ok: false, status: 0 }; }
    })() : Promise.resolve({ ok: false, status: -1 }),
  ]);
  const googleSession = await getGoogleAccess(request);
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.MEAI_GOOGLE_REDIRECT_URI && process.env.MEAI_SESSION_SECRET);
  connectors.push(
    { id: "google", label: "Google Workspace", configured: googleConfigured, connected: Boolean(googleSession), verified: Boolean(googleSession), mode: "OAuth / Drive / Calendar read-only", detail: !googleConfigured ? "أكمل إعدادات Google OAuth وMEAI_SESSION_SECRET." : googleSession ? "تم التحقق من جلسة Google؛ يمكن قراءة ملفات Drive وأحداث التقويم القادمة." : "بيانات OAuth مهيأة لكن لم يتم ربط حساب Google في هذا المتصفح." },
    { id: "supabase", label: "Supabase", configured: supabase, connected: supabaseResult.ok, verified: supabaseResult.status !== -1, mode: "Project health", detail: !supabase ? "بيانات المشروع غير مهيأة." : supabaseResult.ok ? "نجح فحص حي لخدمة Auth؛ هذا لا يثبت إعداد قاعدة البيانات أو سياسات RLS." : supabaseResult.status === 0 ? "تعذر الوصول إلى Supabase أثناء الفحص." : `فشل فحص Supabase (HTTP ${supabaseResult.status})؛ تحقق من رابط المشروع ومفتاح anon.` },
    { id: "cloudflare-ai", label: "Cloudflare Workers AI", configured: cloudflare, connected: cloudflareResult.ok, verified: cloudflareResult.status !== -1, mode: "AI provider", detail: !cloudflare ? "بيانات المزوّد غير مهيأة." : cloudflareResult.ok ? "نجح اختبار حي لواجهة قائمة النماذج باستخدام بيانات الخادم." : cloudflareResult.status === 0 ? "تعذر الوصول إلى Cloudflare أثناء الفحص." : `فشل اختبار Cloudflare (HTTP ${cloudflareResult.status})؛ راجع الرمز والصلاحيات والحساب.` },
    { id: "openai-compatible", label: "OpenAI-compatible provider", configured: compatible, connected: compatibleResult.ok, verified: compatibleResult.status !== -1, mode: "AI provider fallback", detail: !compatible ? "بيانات المزوّد غير مهيأة." : compatibleResult.ok ? "نجح اختبار حي لنقطة /models باستخدام بيانات الخادم." : compatibleResult.status === 0 ? "تعذر الوصول إلى مزوّد OpenAI-compatible أثناء الفحص." : `فشل اختبار المزوّد (HTTP ${compatibleResult.status})؛ راجع عنوان API والرمز.` },
  );

  const result = NextResponse.json({
    checkedAt: new Date().toISOString(),
    connectors,
    note: "verified يعني اختبارًا حيًا محدودًا ومحددًا فقط. لا تُرسل أسرار المزوّد إلى المتصفح.",
  }, { headers: { "Cache-Control": "no-store" } });
  if (googleSession?.cookie) setGoogleSessionCookie(result, googleSession.cookie);
  return result;
}
