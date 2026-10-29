import { rejectCrossOrigin } from "../_lib/guard";
import { NextRequest } from "next/server";

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
  connectors.push(
    { id: "google", label: "Google Workspace", configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), connected: false, verified: false, mode: "OAuth required", detail: "وجود بيانات OAuth وحده لا يعني أن المستخدم فوّض التطبيق. تدفق OAuth غير مكتمل." },
    { id: "supabase", label: "Supabase", configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), connected: false, verified: false, mode: "Project configuration", detail: "تم رصد الإعدادات فقط؛ لم يتم اختبار تسجيل الدخول أو سياسات RLS." },
    { id: "cloudflare-ai", label: "Cloudflare Workers AI", configured: cloudflare, connected: false, verified: false, mode: "AI provider", detail: cloudflare ? "الإعدادات موجودة؛ لم يتم إجراء اختبار حي من نقطة التكامل." : "بيانات المزوّد غير مهيأة." },
    { id: "openai-compatible", label: "OpenAI-compatible provider", configured: compatible, connected: false, verified: false, mode: "AI provider fallback", detail: compatible ? "الإعدادات موجودة؛ لم يتم إجراء اختبار حي من نقطة التكامل." : "بيانات المزوّد غير مهيأة." },
  );

  return Response.json({
    checkedAt: new Date().toISOString(),
    connectors,
    note: "verified يعني اختبارًا حيًا محدودًا ومحددًا فقط. لا تُرسل أسرار المزوّد إلى المتصفح.",
  }, { headers: { "Cache-Control": "no-store" } });
}
