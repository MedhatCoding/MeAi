# Medhat AI Web UI (Next.js)

The repository now contains a new mobile-first Arabic RTL interface under `app/`, separate from the existing Streamlit app. The existing Python app is retained while the new frontend is integrated and tested.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Enable AI chat

The web chat streams OpenAI-compatible Chat Completions events through `app/api/chat/route.ts`. Configure these variables in the hosting provider's **server-side environment settings** (never put keys in browser code):

### Cloudflare Workers AI (preferred)

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `CLOUDFLARE_API_TOKEN`: token permitted to call Workers AI
- `CLOUDFLARE_MODEL`: optional; defaults to `@cf/meta/llama-3.1-8b-instruct`

### Any OpenAI-compatible provider (fallback configuration)

- `OPENAI_BASE_URL`: provider API base URL before `/chat/completions`
- `OPENAI_API_KEY`: secret API key
- `OPENAI_MODEL`: provider model identifier

Example base URL formats vary by provider. Do not include the `/chat/completions` suffix in `OPENAI_BASE_URL`.

If no provider variables are configured, the endpoint intentionally returns HTTP 503 with an actionable Arabic error; it does not fake an AI response.

## Deploy the Next.js frontend

Deploy the repository as a **Next.js project** on a Node-capable host such as Vercel. Use repository root as the project root, build command `npm run build`, and install command `npm install`. Add the server-side environment variables above in the host dashboard and redeploy.

The existing Streamlit deployment does not automatically become a Next.js app just because these files are committed. Keep the Streamlit app available until the Next.js deployment is built, configured, and verified.

## Current scope

The chat API supports incremental SSE rendering. Other sections currently have polished interface scaffolding and local browser state; agent execution, persistent database memory, actual file content processing, and image/video generation still need dedicated API integrations before those sections can be considered fully functional.
