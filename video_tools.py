"""Text-to-video adapter using Hugging Face Inference Providers."""
from __future__ import annotations

import os


def _secret(name: str, default: str = "") -> str:
    try:
        import streamlit as st
        return str(st.secrets.get(name, os.getenv(name, default)) or default)
    except Exception:
        return os.getenv(name, default)


def generate_video(prompt: str, *, model: str = "Wan-AI/Wan2.2-TI2V-5B", negative_prompt: str = "") -> tuple[bytes, str]:
    prompt = (prompt or "").strip()
    model = (model or "").strip()
    if not prompt:
        raise ValueError("اكتب وصف الفيديو أولًا.")
    if len(prompt) > 1800:
        raise ValueError("وصف الفيديو طويل جدًا؛ الحد 1800 حرف.")
    if not model or len(model) > 180:
        raise ValueError("معرّف النموذج غير صالح.")
    token = _secret("HF_TOKEN") or _secret("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        raise RuntimeError("أضف HF_TOKEN في Streamlit Secrets مع صلاحية Inference Providers. قد يتطلب مزوّد الفيديو رصيدًا مدفوعًا.")
    try:
        from huggingface_hub import InferenceClient
    except ImportError as exc:
        raise RuntimeError("مكتبة huggingface_hub غير مثبتة؛ أضفها إلى requirements.txt.") from exc
    try:
        client = InferenceClient(provider=_secret("HF_VIDEO_PROVIDER", "fal-ai"), api_key=token, timeout=240)
        kwargs = {"model": model}
        if negative_prompt:
            kwargs["negative_prompt"] = [negative_prompt[:500]]
        video = client.text_to_video(prompt, **kwargs)
        if hasattr(video, "read"):
            video = video.read()
        data = bytes(video)
        if not data or len(data) < 1024:
            raise RuntimeError("أعاد المزوّد محتوى فارغًا أو غير صالح كفيديو.")
        if not (data.startswith(b"\x00\x00\x00") or b"ftyp" in data[:64]):
            raise RuntimeError("استجابة المزوّد لا تبدو ملف MP4 صالحًا؛ تحقق من النموذج والمزوّد.")
        return data, f"Hugging Face / {_secret('HF_VIDEO_PROVIDER', 'fal-ai')} / {model}"
    except Exception as exc:
        message = str(exc)
        if "401" in message or "403" in message:
            raise RuntimeError("رفض المزوّد الطلب. تحقق من HF_TOKEN وصلاحية Inference Providers وإتاحة النموذج.") from exc
        if "402" in message or "payment" in message.lower() or "credit" in message.lower():
            raise RuntimeError("المزوّد يطلب رصيدًا أو دفعًا؛ لا توجد حصة مجانية مضمونة لهذا النموذج.") from exc
        raise RuntimeError(f"فشل توليد الفيديو: {type(exc).__name__}: {message[:220]}") from exc
