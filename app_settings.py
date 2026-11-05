import os
from pathlib import Path

import requests
import streamlit as st

APP_DIR = Path(__file__).parent
# Streamlit Cloud may mount the repository as read-only; keep the temporary SQLite DB writable.
DB = Path(os.getenv("MEDHAT_AI_DB_PATH", "/tmp/assistant_memory.db"))

def secret(key, default=""):
    try:
        return st.secrets.get(key, os.getenv(key, default))
    except Exception:
        return os.getenv(key, default)

def supabase_config():
    url = secret("SUPABASE_URL").strip().rstrip("/")
    key = secret("SUPABASE_SERVICE_ROLE_KEY") or secret("SUPABASE_KEY")
    return url, key

def cloud_memory_enabled():
    url, key = supabase_config()
    return bool(url and key)

def cloud_memory_request(method, params=None, payload=None):
    url, key = supabase_config()
    if not (url and key):
        raise RuntimeError("إعداد Supabase غير مكتمل.")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if method == "POST":
        headers["Prefer"] = "return=representation"
    response = requests.request(method, url + "/rest/v1/memories", headers=headers, params=params, json=payload, timeout=20)
    if response.status_code >= 400:
        raise RuntimeError(f"Supabase HTTP {response.status_code}: {response.text[:300]}")
    if not response.text.strip():
        return []
    return response.json()
