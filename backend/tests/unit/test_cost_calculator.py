from app.llm.cost_calculator import calculate_cost


def test_known_model_cost() -> None:
    cost = calculate_cost("accounts/fireworks/models/deepseek-v3", 1_000_000, 1_000_000)
    assert cost == pytest.approx(1.80, rel=1e-3)


def test_zero_tokens() -> None:
    assert calculate_cost("accounts/fireworks/models/deepseek-v3", 0, 0) == 0.0


def test_unknown_model_uses_fallback() -> None:
    cost = calculate_cost("unknown/model", 1_000_000, 0)
    assert cost > 0


import pytest  # noqa: E402 (placed after tests for clarity, not best practice)
