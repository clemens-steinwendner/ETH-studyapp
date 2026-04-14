from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.models.exercise import Exercise, Submission
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

    async def delete(self, session_id: int) -> None:
        session = await self.get_by_id(session_id)
        if session:
            self._db.delete(session)
            await self._db.commit()

    async def get_all_with_counts(self) -> list[tuple[StudySession, int, int]]:
        """Return all sessions with per-session pass and fail counts."""
        # Correlated scalar subqueries for pass/fail tallies
        pass_count_sq = (
            select(func.count())
            .select_from(Submission)
            .join(Exercise, Submission.exercise_id == Exercise.id)
            .where(
                Exercise.session_id == StudySession.id,
                (Submission.passed == True) | (Submission.disputed == True),  # noqa: E712
            )
            .correlate(StudySession)
            .scalar_subquery()
        )
        fail_count_sq = (
            select(func.count())
            .select_from(Submission)
            .join(Exercise, Submission.exercise_id == Exercise.id)
            .where(
                Exercise.session_id == StudySession.id,
                Submission.passed == False,  # noqa: E712
                Submission.disputed == False,  # noqa: E712
            )
            .correlate(StudySession)
            .scalar_subquery()
        )
        stmt = (
            select(StudySession, pass_count_sq.label("pass_count"), fail_count_sq.label("fail_count"))
            .order_by(StudySession.created_at.desc())
        )
        result = await self._db.execute(stmt)
        return [(row.StudySession, row.pass_count or 0, row.fail_count or 0) for row in result.all()]
