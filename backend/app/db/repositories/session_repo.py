from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.session import StudySession


class SessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, **kwargs) -> StudySession:  # type: ignore[no-untyped-def]
        session = StudySession(**kwargs)
        self._db.add(session)
        await self._db.commit()
        await self._db.refresh(session)
        return session

    async def get_by_id(self, session_id: int) -> StudySession | None:
        result = await self._db.execute(
            select(StudySession)
            .options(selectinload(StudySession.exercises))
            .where(StudySession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[StudySession]:
        result = await self._db.execute(select(StudySession).order_by(StudySession.created_at.desc()))
        return list(result.scalars().all())
