"""
Vision LLM requests via Fireworks AI.

Used for:
- Diagram captioning during PDF ingestion (FR-04)
- Handwritten proof grading (FR-17)

Note: DeepSeek V3 is text-only. Vision tasks use a separate vision-capable
model configured via FIREWORKS_VISION_MODEL (e.g., llama-v3p2-11b-vision-instruct).
"""
import base64

from app.llm.client import get_vision_client
from app.config import settings


def _encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


async def describe_image(image_bytes: bytes, context_hint: str = "") -> tuple[str, int, int]:
    """
    Generate a semantic description of an image for RAG indexing.

    Returns (description, input_tokens, output_tokens).
    """
    client = get_vision_client()
    b64 = _encode_image(image_bytes)
    prompt = f"Describe this diagram in detail for a computer science study context. {context_hint}".strip()

    response = await client.chat.completions.create(
        model=settings.fireworks_vision_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    content = response.choices[0].message.content or ""
    input_tokens = response.usage.prompt_tokens if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return content, input_tokens, output_tokens


async def grade_proof(image_bytes: bytes, question: str) -> tuple[str, int, int]:
    """
    Vision-grade a handwritten math proof (FR-17).

    Returns (feedback_markdown, input_tokens, output_tokens).
    """
    client = get_vision_client()
    b64 = _encode_image(image_bytes)

    # TODO: load from prompts/grading/vision_proof_grading.md
    system_prompt = (
        "You are a rigorous mathematics tutor. Evaluate the handwritten proof step-by-step. "
        "Identify any logical flaws, missing steps, or notation errors. "
        "Return structured feedback in Markdown."
    )

    response = await client.chat.completions.create(
        model=settings.fireworks_vision_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": f"Question: {question}\n\nPlease grade this proof."},
                ],
            },
        ],
    )
    content = response.choices[0].message.content or ""
    input_tokens = response.usage.prompt_tokens if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return content, input_tokens, output_tokens
