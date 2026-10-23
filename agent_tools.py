"""Safe local project workspace for Medhat AI.

This module intentionally does not execute project code. It supports confined
file operations and static validation only; arbitrary code execution requires
a separate isolated runner/container.
"""
from __future__ import annotations

import ast
import json
import os
import re
from pathlib import Path

WORKSPACE_ROOT = Path(os.getenv("MEDHAT_AI_WORKSPACE", "/tmp/medhat_ai_workspace")).resolve()
MAX_FILE_BYTES = 500_000
ALLOWED_SUFFIXES = {
    ".py", ".txt", ".md", ".json", ".csv", ".yaml", ".yml", ".toml",
    ".html", ".css", ".js", ".ts", ".sql", ".xml", ".sh", ".ini",
}


# Never import secrets, runtime state, dependencies, or generated artifacts.
SKIP_DIRS = {
    ".git", ".github", ".streamlit", ".venv", "venv", "__pycache__",
    "node_modules", "site-packages", "dist", "build", ".pytest_cache",
}
SKIP_NAMES = {
    ".env", ".env.local", ".env.production", "secrets.toml",
    "assistant_memory.db", "assistant_memory.db-wal", "assistant_memory.db-shm",
}
SECRET_NAME_RE = re.compile(r"(secret|credential|token|password|private.?key|api.?key)", re.I)


def initialize_workspace(project_root: str | Path) -> dict:
    """Seed an empty isolated workspace with safe, text-based project files.

    Existing workspace content is never overwritten. Secret-like files and
    generated/dependency directories are excluded.
    """
    source_root = Path(project_root).resolve()
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    existing = list_workspace_files()
    if existing:
        return {"seeded": 0, "existing": len(existing), "workspace": str(WORKSPACE_ROOT)}
    seeded = 0
    skipped = 0
    for source in sorted(source_root.rglob("*")):
        try:
            relative = source.relative_to(source_root)
            if any(part in SKIP_DIRS or part.startswith(".") for part in relative.parts[:-1]):
                skipped += 1
                continue
            if not source.is_file() or source.is_symlink():
                continue
            name = source.name.lower()
            if name in SKIP_NAMES or name.startswith(".env") or SECRET_NAME_RE.search(name):
                skipped += 1
                continue
            if source.suffix.lower() not in ALLOWED_SUFFIXES:
                continue
            if source.stat().st_size > MAX_FILE_BYTES:
                skipped += 1
                continue
            destination = _safe_path(relative.as_posix())
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
            seeded += 1
        except (OSError, ValueError):
            skipped += 1
            continue
    return {"seeded": seeded, "existing": 0, "skipped": skipped, "workspace": str(WORKSPACE_ROOT)}


def _safe_path(relative_path: str) -> Path:
    raw = (relative_path or "").strip().replace("\\", "/")
    if not raw or raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        raise ValueError("اكتب مسارًا نسبيًا داخل مساحة المشروع.")
    parts = Path(raw).parts
    if any(part in ("..", ".") for part in parts):
        raise ValueError("المسار يحتوي على أجزاء غير مسموح بها.")
    if len(parts) > 8 or any(not part or part.startswith(".") for part in parts):
        raise ValueError("المسار عميق جدًا أو يحتوي على اسم مخفي غير مسموح.")
    target = (WORKSPACE_ROOT / Path(*parts)).resolve()
    if target != WORKSPACE_ROOT and WORKSPACE_ROOT not in target.parents:
        raise ValueError("المسار خارج مساحة المشروع.")
    if target.suffix.lower() not in ALLOWED_SUFFIXES:
        raise ValueError(f"امتداد الملف غير مسموح: {target.suffix or '(بدون امتداد)'}")
    return target


def list_workspace_files() -> list[dict]:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    items = []
    for path in sorted(WORKSPACE_ROOT.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        try:
            rel = path.relative_to(WORKSPACE_ROOT).as_posix()
            if path.suffix.lower() in ALLOWED_SUFFIXES and path.stat().st_size <= MAX_FILE_BYTES:
                items.append({"path": rel, "size": path.stat().st_size})
        except OSError:
            continue
    return items[:200]


def read_workspace_file(relative_path: str) -> str:
    path = _safe_path(relative_path)
    if not path.is_file() or path.is_symlink():
        raise FileNotFoundError("الملف غير موجود داخل مساحة المشروع.")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("الملف أكبر من الحد المسموح للقراءة.")
    return path.read_text(encoding="utf-8")


def write_workspace_file(relative_path: str, content: str) -> Path:
    path = _safe_path(relative_path)
    encoded = (content or "").encode("utf-8")
    if len(encoded) > MAX_FILE_BYTES:
        raise ValueError("حجم الملف أكبر من 500 كيلوبايت.")
    if "\x00" in (content or ""):
        raise ValueError("محتوى الملف غير صالح.")
    path.parent.mkdir(parents=True, exist_ok=True)
    # Reject symlinked parent components, even if they resolve inside workspace.
    current = WORKSPACE_ROOT
    for part in path.relative_to(WORKSPACE_ROOT).parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise ValueError("لا يُسمح بمجلدات رمزية داخل مساحة المشروع.")
    path.write_text(content or "", encoding="utf-8")
    return path


def validate_workspace_file(relative_path: str) -> dict:
    path = _safe_path(relative_path)
    content = read_workspace_file(relative_path)
    suffix = path.suffix.lower()
    if suffix == ".py":
        try:
            ast.parse(content, filename=path.name)
            return {"ok": True, "message": "نجح فحص صياغة Python (AST). لم يتم تشغيل الكود."}
        except SyntaxError as exc:
            return {
                "ok": False,
                "message": f"خطأ صياغة في السطر {exc.lineno or '?'}: {exc.msg}",
            }
    if suffix == ".json":
        try:
            json.loads(content)
            return {"ok": True, "message": "ملف JSON صالح."}
        except json.JSONDecodeError as exc:
            return {"ok": False, "message": f"JSON غير صالح عند السطر {exc.lineno}: {exc.msg}"}
    if suffix in {".yaml", ".yml", ".toml", ".xml"}:
        return {
            "ok": None,
            "message": "تم فتح الملف وقراءة ترميزه فقط؛ يلزم مدقق متخصص للتحقق من هذا التنسيق.",
        }
    return {"ok": None, "message": "لا يوجد مدقق صياغة مدمج لهذا الامتداد."}
