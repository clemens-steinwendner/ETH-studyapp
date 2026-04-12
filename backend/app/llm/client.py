"""
Fireworks AI client (OpenAI-compatible API).

Uses DeepSeek V3 for text generation and a vision-capable model for
diagram description and proof grading.

Fireworks AI base URL: https://api.fireworks.ai/inference/v1
"""
from functools import lru_cache

from openai import AsyncOpenAI

from app.config import settings

FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1"


@lru_cache(maxsize=1)
def get_llm_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.fireworks_api_key,
        base_url=FIREWORKS_BASE_URL,
    )


@lru_cache(maxsize=1)
def get_vision_client() -> AsyncOpenAI:
    """Separate client reference — same endpoint, vision model selected at call time."""
    return get_llm_client()
