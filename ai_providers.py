import requests
import streamlit as st

from app_settings import secret

def _provider_configs():
    """Configured text providers in failover order; unconfigured providers are skipped."""
    providers = []
    # Cloudflare Workers AI native REST endpoint (free daily allowance is limited).
    cf_token = secret("CLOUDFLARE_API_TOKEN")
    cf_account = secret("CLOUDFLARE_ACCOUNT_ID")
    if cf_token and cf_account:
        providers.append({
            "name": "Cloudflare Workers AI",
            "kind": "cloudflare",
            "url": f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/run/{secret('CLOUDFLARE_CHAT_MODEL', '@cf/meta/llama-3.1-8b-instruct')}",
            "key": cf_token,
            "model": secret("CLOUDFLARE_CHAT_MODEL", "@cf/meta/llama-3.1-8b-instruct"),
            "headers": {},
        })
    # OpenRouter supports multiple free models, subject to current model availability.
    key = secret("OPENROUTER_API_KEY") or secret("AI_API_KEY")
    if key:
        providers.append({
            "name": "OpenRouter", "kind": "openai",
            "url": (secret("OPENROUTER_BASE_URL") or secret("AI_BASE_URL", "https://openrouter.ai/api/v1")).rstrip("/") + "/chat/completions",
            "key": key, "model": secret("OPENROUTER_MODEL") or secret("AI_MODEL", "openrouter/free"),
            "headers": {"HTTP-Referer": "https://github.com/", "X-Title": "Medhat AI Assistant"},
        })
    key = secret("GROQ_API_KEY")
    if key:
        providers.append({"name": "Groq", "kind": "openai", "url": "https://api.groq.com/openai/v1/chat/completions", "key": key, "model": secret("GROQ_MODEL", "llama-3.3-70b-versatile"), "headers": {}})
    key = secret("CEREBRAS_API_KEY")
    if key:
        providers.append({"name": "Cerebras", "kind": "openai", "url": "https://api.cerebras.ai/v1/chat/completions", "key": key, "model": secret("CEREBRAS_MODEL", "llama3.1-8b"), "headers": {}})
    key = secret("GEMINI_API_KEY") or secret("GOOGLE_API_KEY")
    if key:
        providers.append({"name": "Google Gemini", "kind": "openai", "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "key": key, "model": secret("GEMINI_MODEL", "gemini-2.5-flash"), "headers": {}})
    # Explicitly configured providers can be preferred; remaining providers stay as fallback.
    preferred = secret("AI_PROVIDER", "auto").strip().lower()
    aliases = {"cloudflare": "Cloudflare Workers AI", "openrouter": "OpenRouter", "groq": "Groq", "cerebras": "Cerebras", "gemini": "Google Gemini"}
    if preferred in aliases:
        first = aliases[preferred]
        providers.sort(key=lambda p: p["name"] != first)
    return providers


def call_model(messages):
    providers = _provider_configs()
    if not providers:
        raise RuntimeError(
            "لا يوجد مزوّد ذكاء اصطناعي مُعدّ. أضف بيانات Cloudflare (CLOUDFLARE_ACCOUNT_ID وCLOUDFLARE_API_TOKEN) "
            "أو مفتاح مزوّد آخر في Streamlit Secrets. لا تضع المفاتيح في GitHub."
        )
    errors = []
    for provider in providers:
        headers = {"Authorization": f"Bearer {provider['key']}", "Content-Type": "application/json", **provider["headers"]}
        try:
            if provider["kind"] == "cloudflare":
                # Workers AI REST API expects messages and returns result.response.
                payload = {"messages": messages}
                res = requests.post(provider["url"], headers=headers, json=payload, timeout=90)
            else:
                payload = {"model": provider["model"], "messages": messages, "temperature": 0.4}
                res = requests.post(provider["url"], headers=headers, json=payload, timeout=90)
            if res.status_code >= 400:
                errors.append(f"{provider['name']}: HTTP {res.status_code} — {res.text[:220]}")
                continue
            data = res.json()
            if provider["kind"] == "cloudflare":
                answer = (data.get("result") or {}).get("response", "")
                if not answer and data.get("success") is False:
                    errors.append(f"{provider['name']}: {str(data.get('errors', []))[:180]}")
                    continue
            else:
                answer = data["choices"][0]["message"]["content"]
            if isinstance(answer, list):
                answer = "\n".join(str(part.get("text", part)) if isinstance(part, dict) else str(part) for part in answer)
            if not str(answer).strip():
                errors.append(f"{provider['name']}: رد فارغ")
                continue
            st.session_state["last_ai_provider"] = provider["name"]
            return str(answer)
        except Exception as exc:
            errors.append(f"{provider['name']}: {str(exc)[:180]}")
    raise RuntimeError("فشل كل مزوّدي الذكاء الاصطناعي المُعدّين: " + " | ".join(errors))
