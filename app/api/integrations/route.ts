export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Connector = { id: string; label: string; connected: boolean; mode: string; required: string[] };

export async function GET() {
  const connectors: Connector[] = [
    { id: "github", label: "GitHub", connected: Boolean(process.env.GITHUB_TOKEN), mode: "API token", required: ["GITHUB_TOKEN"] },
    { id: "google", label: "Google Workspace", connected: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), mode: "OAuth credentials only; user authorization flow required", required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
    { id: "supabase", label: "Supabase", connected: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), mode: "Project configuration detected; per-user auth/RLS must be configured", required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
    { id: "cloudflare-ai", label: "Cloudflare Workers AI", connected: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN), mode: "AI provider", required: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
    { id: "openai-compatible", label: "OpenAI-compatible provider", connected: Boolean(process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), mode: "AI provider fallback", required: ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"] },
  ];
  return Response.json({
    checkedAt: new Date().toISOString(),
    connectors,
    note: "Connected means server configuration was detected, not that a live third-party authorization or action was tested. Google needs a completed OAuth flow. Never send provider secrets to the browser.",
  }, { headers: { "Cache-Control": "no-store" } });
}
