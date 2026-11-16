export type ModelConfig = { provider: "cloudflare" | "openai-compatible"; endpoint: string; token: string; model: string };

export function getModelConfig(): ModelConfig | null {
  const cloudflareId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflare: ModelConfig | null = cloudflareId && cloudflareToken ? {
    provider: "cloudflare",
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${cloudflareId}/ai/v1/chat/completions`,
    token: cloudflareToken,
    model: process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct",
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

  // Explicit preference only; default remains Cloudflare for backward compatibility.
  return process.env.MEAI_MODEL_PROVIDER === "openai-compatible"
    ? compatible || cloudflare
    : cloudflare || compatible;
}

export function getConfiguredModelProviders(): string[] {
  const providers: string[] = [];
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) providers.push("cloudflare");
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) providers.push("openai-compatible");
  return providers;
}
