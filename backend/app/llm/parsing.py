"""
Shared LLM response parsing utilities.

Used by exercise_service and grading_service to robustly extract
structured JSON from LLM responses that may contain prose, code fences, etc.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)


def extract_json(text: str) -> dict | list:
    """Robustly extract the first JSON value (object or array) from an LLM response.

    Tries in order:
    1. JSON wrapped in a ```json ... ``` code fence (preferred — prompts request this)
    2. Balanced-brace scan for objects  (fallback)
    3. Balanced-bracket scan for arrays (fallback for top-level array responses)

    Returns an empty dict and logs an error if extraction fails entirely.
    """
    # 1. Code fence: ```json\n...\n```
    fence_match = re.search(r"```json\s*\n([\s\S]*?)\n```", text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    def _balanced_scan(text: str, open_ch: str, close_ch: str):
        for start_match in re.finditer(re.escape(open_ch), text):
            start = start_match.start()
            depth, end = 0, -1
            for i, ch in enumerate(text[start:], start):
                if ch == open_ch:
                    depth += 1
                elif ch == close_ch:
                    depth -= 1
                if depth == 0:
                    end = i
                    break
            if end != -1:
                candidate = text[start : end + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
        return None

    # 2. Balanced-brace scan (objects)
    result = _balanced_scan(text, "{", "}")
    if result is not None:
        return result

    # 3. Balanced-bracket scan (arrays)
    result = _balanced_scan(text, "[", "]")
    if result is not None:
        return result

    logger.error(
        "extract_json: failed to parse JSON from LLM response (first 400 chars): %.400s",
        text,
    )
    return {}
