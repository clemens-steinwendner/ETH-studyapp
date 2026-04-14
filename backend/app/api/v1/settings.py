"""
User-configurable app settings (currently: LLM model selection).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.dependencies import DbSession
from app.db.repositories.settings_repo import SettingsRepository
from app.services.settings_service import ALLOWED_MODEL_IDS, ALLOWED_MODELS, get_active_model

router = APIRouter()


class SettingsOut(BaseModel):
    fireworks_model: str
    allowed_models: list[dict]


class SettingsUpdate(BaseModel):
    fireworks_model: str


@router.get("/", response_model=SettingsOut)
async def get_settings(db: DbSession) -> SettingsOut:
    """Return current app settings."""
    model = await get_active_model(db)
    return SettingsOut(fireworks_model=model, allowed_models=ALLOWED_MODELS)


@router.put("/", response_model=SettingsOut)
async def update_settings(body: SettingsUpdate, db: DbSession) -> SettingsOut:
    """Update app settings. Only model IDs from the allowed list are accepted."""
    if body.fireworks_model not in ALLOWED_MODEL_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Model not allowed. Choose from: {', '.join(ALLOWED_MODEL_IDS)}",
        )
    await SettingsRepository(db).set("fireworks_model", body.fireworks_model)
    return SettingsOut(fireworks_model=body.fireworks_model, allowed_models=ALLOWED_MODELS)
