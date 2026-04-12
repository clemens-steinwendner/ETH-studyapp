"""
Token cost calculator for Fireworks AI models (FR-23).

Pricing source: https://fireworks.ai/pricing (as of 2026)
Prices are in USD per 1M tokens.
"""

# Cost per 1M tokens (input, output) in USD
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "accounts/fireworks/models/deepseek-v3": (0.90, 0.90),
    "accounts/fireworks/models/deepseek-v3-0324": (0.90, 0.90),
    "accounts/fireworks/models/llama-v3p2-11b-vision-instruct": (0.20, 0.20),
    "accounts/fireworks/models/llama-v3p2-90b-vision-instruct": (0.90, 0.90),
}

_DEFAULT_PRICE = (1.00, 1.00)  # fallback for unknown models


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return the USD cost for a single API call."""
    input_price, output_price = MODEL_PRICING.get(model, _DEFAULT_PRICE)
    return (input_tokens * input_price + output_tokens * output_price) / 1_000_000
