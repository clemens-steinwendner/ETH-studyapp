"""
Vision LLM captioning for extracted diagram images (FR-04).

Passes image bytes to the Fireworks AI Vision API and returns a
searchable semantic description, plus token counts for budget tracking.
"""
import logging

from app.llm import vision

_log = logging.getLogger(__name__)


async def describe_diagram(image_bytes: bytes, page: int) -> tuple[str, int, int]:
    """
    Call the Vision LLM to produce a semantic description of a diagram.

    Returns (description, input_tokens, output_tokens).
    On any API error (e.g. model not available), returns empty strings and
    zero token counts so the rest of ingestion can continue.
    """
    try:
        return await vision.describe_image(image_bytes, context_hint=f"page {page + 1}")
    except Exception as exc:
        _log.warning("diagram description skipped (page %d): %s", page + 1, exc)
        return "", 0, 0
