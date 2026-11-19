export type ModelConfig = { provider: "cloudflare" | "openai-compatible" | "gemini" | "groq"; endpoint: string; token: string; model: string };

function configuredProviders(): Record<ModelConfig["provider"], ModelConfig | null> {
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
  return { cloudflare, gemini, groq, "openai-compatible": compatible };
}

export function getConfiguredModelConfigs(): ModelConfig[] {
  const providers = configuredProviders();
  const defaultOrder: ModelConfig["provider"][] = ["cloudflare", "gemini", "groq", "openai-compatible"];
  const preference = process.env.MEAI_MODEL_PROVIDER as ModelConfig["provider"] | undefined;
  const order = preference && defaultOrder.includes(preference)
    ? [preference, ...defaultOrder.filter(provider => provider !== preference)]
    : defaultOrder;
  return order.map(provider => providers[provider]).filter((value): value is ModelConfig => Boolean(value));
}

export function getModelConfig(): ModelConfig | null {
  return getConfiguredModelConfigs()[0] || null;
}

export function getConfiguredModelProviders(): string[] {
  return getConfiguredModelConfigs().map(config => config.provider);
}

/** Try the preferred provider, then each configured fallback once. */
export async function fetchModelWithFallback(primary: ModelConfig, init: RequestInit): Promise<Response> {
  const candidates = [primary, ...getConfiguredModelConfigs().filter(config => config.provider !== primary.provider)];
  let lastError: unknown = null;
  let lastResponse: Response | null = null;
  for (const config of candidates) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    let body = init.body;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && "model" in parsed) {
          parsed.model = config.model;
          body = JSON.stringify(parsed);
        }
      } catch { /* Keep non-JSON request bodies unchanged. */ }
    }
    try {
      const response = await fetch(config.endpoint, { ...init, headers, body, cache: "no-store" });
      const taggedHeaders = new Headers(response.headers);
      taggedHeaders.set("X-MeAI-Provider", config.provider);
      const tagged = new Response(response.body, { status: response.status, statusText: response.statusText, headers: taggedHeaders });
      if (response.ok) return tagged;
      lastResponse = tagged;
      const retryable = [401, 403, 404, 408, 409, 425, 429].includes(response.status) || response.status >= 500;
      if (!retryable) return tagged;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      lastError = error;
    }
  }
  if (lastResponse) return lastResponse;
  if (lastError instanceof Error) throw lastError;
  throw new Error("تعذر الاتصال بجميع مزودي الذكاء الاصطناعي المهيئين.");
}

// Image requests only use providers with an explicitly supported vision route.
export function getVisionModelConfig(): ModelConfig | null {
  const key = process.env.GEMINI_API_KEY;
  if (key) return {
    provider: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    token: key,
    model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash",
  };
  const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!cloudflareId || !cloudflareToken) return null;
  const model = process.env.CLOUDFLARE_VISION_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";
  return {
    provider: "cloudflare",
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/run/${model}`,
    token: cloudflareToken,
    model,
  };
}
