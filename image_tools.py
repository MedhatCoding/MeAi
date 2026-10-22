"""Optional image generation through the OpenAI Images API.

Requires OPENAI_API_KEY in the hosting provider's secret store. This API is
metered; the module does not claim or assume free quota.
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


def generate_image(prompt: str, *, size: str = "1024x1024", quality: str = "low") -> tuple[bytes, str]:
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("اكتب وصف الصورة أولًا.")
    if len(prompt) > 8000:
        raise ValueError("وصف الصورة طويل جدًا؛ الحد 8000 حرف.")
    api_key = _secret("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("توليد الصور غير مُعدّ. أضف OPENAI_API_KEY في Streamlit Cloud → App settings → Secrets. لا تضعه في GitHub.")
    allowed_sizes = {"1024x1024", "1536x1024", "1024x1536"}
    if size not in allowed_sizes:
        raise ValueError("مقاس الصورة غير مدعوم.")
    if quality not in {"low", "medium", "high"}:
        raise ValueError("جودة الصورة غير مدعومة.")
    model = _secret("OPENAI_IMAGE_MODEL", "gpt-image-2")
    response = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "prompt": prompt, "size": size, "quality": quality, "n": 1, "output_format": "png"},
        timeout=180,
    )
    if response.status_code >= 400:
        try:
            detail = response.json().get("error", {}).get("message", response.text[:300])
        except Exception:
            detail = response.text[:300]
        raise RuntimeError(f"مزود الصور رفض الطلب (HTTP {response.status_code}): {detail}")
    try:
        encoded = response.json()["data"][0]["b64_json"]
        return base64.b64decode(encoded, validate=True), model
    except (KeyError, IndexError, ValueError) as exc:
        raise RuntimeError("استجابة مزود الصور لم تحتوِ على صورة صالحة.") from exc
