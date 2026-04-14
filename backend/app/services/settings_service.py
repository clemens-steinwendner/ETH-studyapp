"""
Runtime app settings — currently just model selection.

All LLM-calling services should resolve the active model via get_active_model()
rather than reading settings.fireworks_model directly. This allows the user to
switch models from the budget page without restarting the server.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.settings_repo import SettingsRepository

# Models the user is allowed to select from the UI.
ALLOWED_MODELS: list[dict] = [
    {
        "id": "accounts/fireworks/models/deepseek-v3",
        "label": "DeepSeek V3 (default)",
        "note": "~$0.90/M tokens — best quality/price",
    },
    {
        "id": "accounts/fireworks/models/llama-v3p3-70b-instruct",
        "label": "Llama 3.3 70B",
        "note": "~$0.90/M tokens — good quality, slightly cheaper",
    },
    {
        "id": "accounts/fireworks/models/llama-v3p1-8b-instruct",
        "label": "Llama 3.1 8B",
        "note": "~$0.20/M tokens — cheapest, lower quality",
    },
    {
        "id": "accounts/fireworks/models/qwen2p5-72b-instruct",
        "label": "Qwen 2.5 72B",
        "note": "~$0.90/M tokens — strong at math/code",
    },
]

ALLOWED_MODEL_IDS = {m["id"] for m in ALLOWED_MODELS}


async def get_active_model(db: AsyncSession) -> str:
    """Return the currently selected LLM model ID, falling back to settings.fireworks_model."""
    stored = await SettingsRepository(db).get("fireworks_model")
    return stored or settings.fireworks_model
