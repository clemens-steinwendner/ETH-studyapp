"""
Vision LLM captioning for extracted diagram images (FR-04).

Passes image bytes to the Anthropic Vision API and returns a
searchable semantic description that is stored alongside the image reference.
"""


async def describe_diagram(image_bytes: bytes, page: int) -> str:
    """
    Call the Vision LLM to produce a semantic description of a diagram.

    Returns a plain-text description suitable for embedding.
    """
    # TODO: call llm.vision.describe_image(image_bytes, context_hint=f"page {page}")
    raise NotImplementedError
