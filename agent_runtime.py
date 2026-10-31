"""Bounded agent runtime with isolated E2B code execution.

Generated code runs only in a short-lived remote sandbox. It never runs on
the Streamlit host and cannot directly modify the application repository.
"""
from __future__ import annotations

import json

from agent_tools import (
    list_workspace_files,
    read_workspace_file,
    validate_workspace_file,
    write_workspace_file,
)

MAX_ACTIONS = 6
MAX_TOOL_OUTPUT = 8000
MAX_CODE_BYTES = 20_000
CODE_TIMEOUT_SECONDS = 20


def run_code_in_sandbox(code: str, *, api_key: str, language: str = "python"):
    """Run bounded Python code in a fresh E2B Code Interpreter sandbox."""
    if not api_key:
        raise RuntimeError("مفتاح E2B_API_KEY غير مضبوط في Streamlit Secrets.")
    if not isinstance(code, str) or not code.strip():
        raise ValueError("الكود فارغ.")
    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        raise ValueError(f"حجم الكود يتجاوز الحد المسموح ({MAX_CODE_BYTES} بايت).")
    if language != "python":
        raise ValueError("التنفيذ متاح حاليًا للغة Python فقط.")

    try:
        from e2b_code_interpreter import Sandbox
    except ImportError as exc:
        raise RuntimeError("حزمة e2b-code-interpreter غير مثبتة؛ أعد نشر التطبيق بعد تحديث المتطلبات.") from exc

    # Older e2b-code-interpreter releases expose Sandbox() rather than
    # Sandbox.create(). Support both SDK entry points.
    sandbox = None
    try:
        if callable(getattr(Sandbox, "create", None)):
            sandbox = Sandbox.create(api_key=api_key)
        else:
            sandbox = Sandbox(api_key=api_key)

        execution = sandbox.run_code(
            code,
            language="python",
            timeout=CODE_TIMEOUT_SECONDS,
            request_timeout=CODE_TIMEOUT_SECONDS + 15,
        )
        output = getattr(execution, "text", "") or ""
        logs = getattr(execution, "logs", None)
        if logs is not None:
            stdout = getattr(logs, "stdout", None) or []
            stderr = getattr(logs, "stderr", None) or []
            log_output = "\n".join(str(item) for item in [*stdout, *stderr])
            if log_output:
                output = (output + "\n" if output else "") + log_output
        error = getattr(execution, "error", None)
        if error:
            output = (output + "\n" if output else "") + str(error)
        return {
            "language": language,
            "output": (output or "اكتمل التنفيذ دون مخرجات نصية.")[:MAX_TOOL_OUTPUT],
            "has_error": bool(error),
            "sandbox": "E2B ephemeral sandbox",
            "timeout_seconds": CODE_TIMEOUT_SECONDS,
        }
    finally:
        if sandbox is not None:
            close = getattr(sandbox, "kill", None) or getattr(sandbox, "close", None)
            if callable(close):
                close()


def execute_agent_actions(
    actions,
    *,
    search_fn,
    allow_writes=False,
    e2b_api_key="",
    max_actions=MAX_ACTIONS,
):
    """Execute a bounded, ordered tool plan and return auditable results."""
    if not isinstance(actions, list):
        raise ValueError("قائمة إجراءات الوكيل غير صالحة.")
    allowed_count = max(0, min(int(max_actions), MAX_ACTIONS))
    if len(actions) > allowed_count:
        raise ValueError(f"الحد الأقصى {allowed_count} إجراءات؛ اعد تقسيم الخطة.")
    results = []
    for index, action in enumerate(actions, start=1):
        label = f"{index}. {action.get('type', 'unknown')}" if isinstance(action, dict) else f"{index}. invalid"
        try:
            if not isinstance(action, dict):
                raise ValueError("الإجراء يجب أن يكون كائن JSON.")
            kind = action.get("type")
            if kind == "search_web":
                query = str(action.get("query", "")).strip()
                if not query or len(query) > 500:
                    raise ValueError("استعلام البحث فارغ أو طويل جدًا.")
                output = search_fn(query)
            elif kind == "list_files":
                output = list_workspace_files()
            elif kind == "read_file":
                output = read_workspace_file(str(action.get("path", "")))
            elif kind == "validate_file":
                output = validate_workspace_file(str(action.get("path", "")))
            elif kind == "run_code":
                output = run_code_in_sandbox(
                    action.get("code", ""),
                    api_key=e2b_api_key,
                    language=str(action.get("language", "python")).lower(),
                )
            elif kind == "write_file":
                if not allow_writes:
                    raise PermissionError("إنشاء الملفات غير مصرح به؛ فعّل موافقة إنشاء ملفات مساحة العمل.")
                path = str(action.get("path", ""))
                content = action.get("content", "")
                if not isinstance(content, str):
                    raise ValueError("محتوى الملف يجب أن يكون نصًا.")
                write_workspace_file(path, content)
                output = {"path": path, "validation": validate_workspace_file(path)}
            else:
                raise ValueError("نوع الأداة غير مسموح.")
            rendered = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False, default=str)
            status = "فشل" if kind == "run_code" and isinstance(output, dict) and output.get("has_error") else "تم"
            results.append({"action": label, "status": status, "message": rendered[:MAX_TOOL_OUTPUT]})
        except Exception as exc:
            results.append({"action": label, "status": "فشل", "message": f"{type(exc).__name__}: {str(exc)[:500]}"})
    return results
