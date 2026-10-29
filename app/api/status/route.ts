import { NextRequest } from "next/server";
import { rejectCrossOrigin } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const cloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const compatible = Boolean(process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const provider = cloudflare ? "Cloudflare Workers AI" : compatible ? "OpenAI-compatible API" : null;
  const githubConfigured = Boolean(process.env.GITHUB_TOKEN);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return Response.json({
    checkedAt: new Date().toISOString(),
    configured: Boolean(provider),
    provider,
    model: cloudflare ? (process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct") : compatible ? process.env.OPENAI_MODEL : null,
    features: {
      chat: Boolean(provider),
      agentPlanning: Boolean(provider),
      // The general-purpose agent can perform model-backed work and bounded read-only integrations; it is not a shell/code sandbox.
      agentExecution: Boolean(provider),
      imageGeneration: cloudflare,
      videoGeneration: false,
      webSearch: Boolean(process.env.SERPER_API_KEY),
      // Config presence is not equivalent to authentication or durable per-user storage.
      persistentCloudMemory: false,
      githubConfigured,
      githubSourceEditing: Boolean(githubConfigured && process.env.MEAI_AGENT_EDIT_ENABLED === "true"),
      googleOAuthConfigured,
      supabaseConfigured,
    },
    readiness: {
      chat: provider ? "configured_not_live_tested" : "missing_provider",
      webSearch: process.env.SERPER_API_KEY ? "configured_not_live_tested" : "missing_api_key",
      github: githubConfigured ? "token_configured_identity_and_repository_access_must_be_checked" : "missing_token",
      githubSourceEditing: process.env.MEAI_AGENT_EDIT_ENABLED === "true" && githubConfigured ? "explicitly_enabled" : "disabled_by_default",
      cloudMemory: supabaseConfigured ? "project_configured_auth_and_rls_unverified" : "missing_supabase_config",
      google: googleOAuthConfigured ? "oauth_credentials_only_flow_incomplete" : "missing_oauth_credentials",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
