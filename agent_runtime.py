"""Bounded execution runtime for the personal assistant agent.

Only explicitly allow-listed tools are callable. No shell, Python execution,
network writes, or external side effects are exposed here.
"""
from __future__ import annotations

from agent_tools import list_workspace_files, read_workspace_file, validate_workspace_file, write_workspace_file

MAX_ACTIONS = 6
MAX_TOOL_OUTPUT = 5000


def execute_agent_actions(actions, *, search_fn, allow_writes=False, max_actions=MAX_ACTIONS):
    """Execute a bounded, ordered tool plan and return auditable results."""
    if not isinstance(actions, list):
        raise ValueError("قائمة إجراءات الوكيل غير صالحة.")
    # Enforce the safety limit without aborting the whole cycle when a model
    # returns too many actions. Only the first ordered actions are eligible.
    allowed_count = max(0, min(int(max_actions), MAX_ACTIONS))
    omitted_count = max(0, len(actions) - allowed_count)
    actions = actions[:allowed_count]
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
            elif kind == "write_file":
                if not allow_writes:
                    raise PermissionError("الكتابة غير مفعّلة؛ أكد وضع إنشاء الملفات.")
                path = str(action.get("path", ""))
                content = action.get("content", "")
                if not isinstance(content, str):
                    raise ValueError("محتوى الملف يجب أن يكون نصًا.")
                saved = write_workspace_file(path, content)
                validation = validate_workspace_file(path)
                output = {"path": saved.relative_to(saved.parents[len(saved.parts)-len(saved.parts)]).as_posix() if False else path,
                          "validation": validation}
            else:
                raise ValueError("نوع الأداة غير مسموح.")
            import json
            rendered = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False, default=str)
            results.append({"action": label, "status": "تم", "message": rendered[:MAX_TOOL_OUTPUT]})
        except Exception as exc:
            results.append({"action": label, "status": "فشل", "message": f"{type(exc).__name__}: {str(exc)[:500]}"})
    if omitted_count:
        results.append({
            "action": "حد الأمان",
            "status": "تم التجاوز بأمان",
            "message": f"تم تجاهل {omitted_count} إجراء/إجراءات زائدة؛ الحد الأقصى المسموح {allowed_count}."
        })
    return results
