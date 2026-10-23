"""Defensive parser for structured plans returned by the model."""
import json
import re


def parse_agent_json_response(response):
    """Parse model output defensively; never execute returned text."""
    if not isinstance(response, str) or not response.strip():
        raise ValueError("لم يُرجع النموذج خطة. أعد المحاولة.")
    cleaned = response.strip().lstrip("\ufeff")
    cleaned = cleaned.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    cleaned = re.sub(r"^\s*```(?:json)?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    if len(cleaned) > 100_000:
        raise ValueError("رد النموذج أكبر من الحد المسموح لتحليل الخطة.")
    # Extract balanced JSON objects while respecting quoted strings and escapes.
    spans = [index for index, char in enumerate(cleaned) if char == "{"][:20]
    last_error = None
    for start in spans:
        depth = 0
        in_string = False
        escaped = False
        end = None
        for index in range(start, len(cleaned)):
            char = cleaned[index]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = index + 1
                    break
        if end is None:
            continue
        candidate = cleaned[start:end]
        attempts = [candidate]
        fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
        fixed = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', fixed)
        attempts.append(fixed)
        for attempt in attempts:
            try:
                result = json.loads(attempt)
            except (json.JSONDecodeError, TypeError, RecursionError) as exc:
                last_error = exc
                continue
            if isinstance(result, dict):
                return result
    if isinstance(last_error, json.JSONDecodeError):
        raise ValueError(f"رد النموذج غير صالح أو غير مكتمل قرب العمود {last_error.colno}. جرت محاولة تصحيح واحدة.") from last_error
    raise ValueError("تعذر قراءة خطة الوكيل. جرت محاولة تصحيح واحدة؛ لم تُنفذ إجراءات.") from last_error
