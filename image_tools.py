"""Image generation with provider selection and safe, explicit configuration.

IMAGE_PROVIDER=auto prefers Cloudflare Workers AI, then OpenAI if configured.
Cloudflare's daily free allocation is limited and subject to provider terms.
"""
from __future__ import annotations

import base64
import os

import requests


def _secret(name: str, default: str = "") -> str:
    try:
        import streamlit as st
        return str(st.secrets.get(name, os.getenv(name, default)) or default)
    except Exception:
        return os.getenv(name, default)


def _configured_providers() -> list[str]:
    selected = _secret("IMAGE_PROVIDER", "auto").strip().lower()
    has_cf = bool(_secret("CLOUDFLARE_ACCOUNT_ID") and _secret("CLOUDFLARE_API_TOKEN"))
    has_openai = bool(_secret("OPENAI_API_KEY"))
    if selected == "cloudflare":
        return ["cloudflare"] if has_cf else []
    if selected == "openai":
        return ["openai"] if has_openai else []
    providers = []
    if has_cf:
        providers.append("cloudflare")
    if has_openai:
        providers.append("openai")
    return providers


def generate_image(prompt: str, *, size: str = "1024x1024", quality: str = "low") -> tuple[bytes, str]:
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("اكتب وصف الصورة أولًا.")
    if len(prompt) > 2048:
        raise ValueError("وصف الصورة طويل جدًا؛ الحد 2048 حرفًا للموديل الحالي.")
    if size not in {"1024x1024", "1536x1024", "1024x1536"}:
        raise ValueError("مقاس الصورة غير مدعوم.")
    if quality not in {"low", "medium", "high"}:
        raise ValueError("جودة الصورة غير مدعومة.")
    providers = _configured_providers()
    if not providers:
        raise RuntimeError(
            "لا يوجد مزوّد صور مُعدّ. أضف CLOUDFLARE_ACCOUNT_ID وCLOUDFLARE_API_TOKEN لتوليد الصور عبر Cloudflare، "
            "أو OPENAI_API_KEY لاستخدام OpenAI. اختر IMAGE_PROVIDER=auto أو cloudflare أو openai في Secrets."
        )
    errors = []
    for provider in providers:
        try:
            if provider == "cloudflare":
                account = _secret("CLOUDFLARE_ACCOUNT_ID")
                token = _secret("CLOUDFLARE_API_TOKEN")
                model = _secret("CLOUDFLARE_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell")
                # FLUX.1 Schnell accepts prompt and steps; size/quality selectors are not passed as unsupported params.
                steps = {"low": 4, "medium": 6, "high": 8}[quality]
                response = requests.post(
                    f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"prompt": prompt, "steps": steps},
                    timeout=180,
                )
                label = f"Cloudflare Workers AI ({model})"
                if response.status_code >= 400:
                    errors.append(f"{label}: HTTP {response.status_code} — {response.text[:220]}")
                    continue
                data = response.json()
                encoded = (data.get("result") or {}).get("image") or data.get("image")
                if not encoded:
                    errors.append(f"{label}: استجابة بلا صورة صالحة")
                    continue
                return base64.b64decode(encoded, validate=True), label
            api_key = _secret("OPENAI_API_KEY")
            model = _secret("OPENAI_IMAGE_MODEL", "gpt-image-2")
            response = requests.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "prompt": prompt, "size": size, "quality": quality, "n": 1, "output_format": "png"},
                timeout=180,
            )
            if response.status_code >= 400:
                errors.append(f"OpenAI: HTTP {response.status_code} — {response.text[:220]}")
                continue
            encoded = response.json()["data"][0]["b64_json"]
            return base64.b64decode(encoded, validate=True), model
        except (KeyError, IndexError, ValueError) as exc:
            errors.append(f"{provider}: استجابة غير صالحة ({str(exc)[:100]})")
        except Exception as exc:
            errors.append(f"{provider}: {str(exc)[:160]}")
    raise RuntimeError("فشل مزوّدو الصور المُعدّون: " + " | ".join(errors))
