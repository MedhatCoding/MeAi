export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const compatible = Boolean(process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const provider = cloudflare ? "Cloudflare Workers AI" : compatible ? "OpenAI-compatible API" : null;
  return Response.json({
    configured: Boolean(provider),
    provider,
    model: cloudflare ? (process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct") : compatible ? process.env.OPENAI_MODEL : null,
    features: {
      chat: Boolean(provider),
      agentExecution: false,
      imageGeneration: false,
      videoGeneration: false,
      webSearch: Boolean(process.env.SERPER_API_KEY),
      persistentCloudMemory: false,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
