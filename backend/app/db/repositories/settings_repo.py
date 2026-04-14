from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.app_settings import AppSettings


class SettingsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, key: str) -> str | None:
        obj = await self._db.get(AppSettings, key)
        return obj.value if obj else None

    async def set(self, key: str, value: str) -> None:
        obj = await self._db.get(AppSettings, key)
        if obj:
            obj.value = value
        else:
            obj = AppSettings(key=key, value=value)
            self._db.add(obj)
        await self._db.commit()
