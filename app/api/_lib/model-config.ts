export type ModelConfig = { provider: "cloudflare" | "openai-compatible" | "gemini" | "groq"; endpoint: string; token: string; model: string };

export function getModelConfig(): ModelConfig | null {
  const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflare: ModelConfig | null = cloudflareId && cloudflareToken ? {
    provider: "cloudflare",
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/v1/chat/completions`,
    token: cloudflareToken,
    model: process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct",
  } : null;

  const geminiKey = process.env.GEMINI_API_KEY;
  const gemini: ModelConfig | null = geminiKey ? {
    provider: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    token: geminiKey,
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  } : null;

  const groqKey = process.env.GROQ_API_KEY;
  const groq: ModelConfig | null = groqKey ? {
    provider: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    token: groqKey,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  } : null;

  const base = process.env.OPENAI_BASE_URL;
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  const compatible: ModelConfig | null = base && key && model ? {
    provider: "openai-compatible",
    endpoint: base.replace(/\/+$/, "") + "/chat/completions",
    token: key,
    model,
  } : null;

  const providers: Record<string, ModelConfig | null> = {
    cloudflare, gemini, groq, "openai-compatible": compatible,
  };
  const preference = process.env.MEAI_MODEL_PROVIDER;
  if (preference && providers[preference]) return providers[preference] || cloudflare || gemini || groq || compatible;
  // Prefer the existing provider for compatibility, then free-tier alternatives.
  return cloudflare || gemini || groq || compatible;
}

export function getConfiguredModelProviders(): string[] {
  const providers: string[] = [];
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) providers.push("cloudflare");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) providers.push("openai-compatible");
  return providers;
}


// Vision is routed explicitly to Cloudflare Llama Vision or Gemini, never to the default text-only model.
export function getVisionModelConfig(): ModelConfig | null {
  const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  if (cloudflareId && cloudflareToken) {
    const model = process.env.CLOUDFLARE_VISION_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";
    return {
      provider: "cloudflare",
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/run/${model}`,
      token: cloudflareToken,
      model,
    };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return {
    provider: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    token: key,
    model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash",
  };
}
