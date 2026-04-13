"""
Shared LLM response parsing utilities.

Used by exercise_service and grading_service to robustly extract
structured JSON from LLM responses that may contain prose, code fences, etc.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)


def extract_json(text: str) -> dict:
    """Robustly extract the first JSON object from an LLM response.

    Tries in order:
    1. JSON wrapped in a ```json ... ``` code fence (preferred — prompts request this)
    2. Balanced-brace scan (fallback for models that ignore code fences)

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

    # 2. Balanced-brace scan: walk from each '{' to its matching '}'
    for start_match in re.finditer(r"\{", text):
        start = start_match.start()
        depth, end = 0, -1
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
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

    logger.error(
        "extract_json: failed to parse JSON from LLM response (first 400 chars): %.400s",
        text,
    )
    return {}
