import { NextRequest } from "next/server";
import { rejectCrossOrigin } from "../_lib/guard";
import { apiAuthRequired } from "../_lib/api-access";
import { getModelConfig, getConfiguredModelProviders } from "../_lib/model-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const modelConfig = getModelConfig();
  const configuredModelProviders = getConfiguredModelProviders();
  const cloudflareVisionConfigured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const imageUnderstandingConfigured = cloudflareVisionConfigured || Boolean(process.env.GEMINI_API_KEY);
  const provider = modelConfig?.provider === "cloudflare" ? "Cloudflare Workers AI" : modelConfig?.provider === "gemini" ? "Google Gemini API" : modelConfig?.provider === "groq" ? "Groq API" : modelConfig?.provider === "openai-compatible" ? "OpenAI-compatible API" : null;
  const githubConfigured = Boolean(process.env.GITHUB_TOKEN);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const searchProviders = [
    ...(process.env.SERPER_API_KEY ? ["serper"] : []),
    ...(process.env.BRAVE_SEARCH_API_KEY ? ["brave"] : []),
    ...(process.env.TAVILY_API_KEY ? ["tavily"] : []),
    ...(process.env.ENDLESS_SEARCH_KEY ? ["endless"] : []),
    ...(process.env.LANGSEARCH_API_KEY ? ["langsearch"] : []),
  ];
  const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.MEAI_GOOGLE_REDIRECT_URI && process.env.NEXT_PUBLIC_SITE_URL && process.env.MEAI_SESSION_SECRET && process.env.MEAI_SESSION_SECRET.length >= 32);

  return Response.json({
    checkedAt: new Date().toISOString(),
    configured: Boolean(provider),
    provider,
    model: modelConfig?.model || null,
    modelRouting: { selectedProvider: modelConfig?.provider || null, configuredProviders: configuredModelProviders, preference: process.env.MEAI_MODEL_PROVIDER || "cloudflare" },
    features: {
      chat: Boolean(provider),
      agentPlanning: Boolean(provider),
      // The general-purpose agent can perform model-backed work and bounded read-only integrations; it is not a shell/code sandbox.
      agentExecution: Boolean(provider),
      agentSandbox: Boolean(process.env.E2B_API_KEY),
      imageUnderstanding: imageUnderstandingConfigured,
      imageGeneration: false,
      videoGeneration: false,
      webSearch: searchProviders.length > 0,
      webSearchProviders: searchProviders,
      // Config presence is not equivalent to authentication or durable per-user storage.
      persistentCloudMemory: supabaseConfigured,
      cloudFileStorage: supabaseConfigured,
      githubConfigured,
      githubSourceEditing: Boolean(githubConfigured && process.env.MEAI_AGENT_EDIT_ENABLED === "true"),
      googleOAuthConfigured,
      supabaseConfigured,
      apiAuthRequired: apiAuthRequired(),
    },
    readiness: {
      chat: provider ? "configured_not_live_tested" : "missing_provider",
      imageUnderstanding: cloudflareVisionConfigured ? "cloudflare_llama_vision_configured_meta_license_may_be_required_not_live_tested" : process.env.GEMINI_API_KEY ? "gemini_multimodal_configured_not_live_tested" : "missing_vision_provider",
      webSearch: searchProviders.length > 0 ? "configured_not_live_tested" : "missing_search_provider_key",
      webSearchProviders: searchProviders,
      codeExecution: process.env.E2B_API_KEY ? "e2b_python_sandbox_configured_not_live_tested" : "missing_e2b_api_key",
      agentSandbox: process.env.E2B_API_KEY ? "python_execution_route_available_not_live_tested" : "missing_e2b_api_key",
      github: githubConfigured ? "token_configured_identity_and_repository_access_must_be_checked" : "missing_token",
      githubSourceEditing: process.env.MEAI_AGENT_EDIT_ENABLED === "true" && githubConfigured ? "explicitly_enabled" : "disabled_by_default",
      cloudMemory: supabaseConfigured ? "supabase_project_configured_rls_verified_account_auth_required_for_sync" : "missing_supabase_config",
      cloudFileStorage: supabaseConfigured ? "private_bucket_configured_resumable_uploads_up_to_50mb_per_file_account_required" : "missing_supabase_config",
      google: googleOAuthConfigured ? "oauth_flow_implemented_account_consent_required_and_google_apis_must_be_enabled" : "missing_oauth_configuration",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
