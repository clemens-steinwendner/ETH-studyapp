from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.exercise import Exercise, Submission


class ExerciseRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, **kwargs) -> Exercise:  # type: ignore[no-untyped-def]
        ex = Exercise(**kwargs)
        self._db.add(ex)
        await self._db.commit()
        await self._db.refresh(ex)
        return ex

    async def get_by_id(self, exercise_id: int) -> Exercise | None:
        return await self._db.get(Exercise, exercise_id)

    async def get_failed_exercises(self, session_ids: list[int] | None = None) -> list[Exercise]:
        """Return exercises whose latest submission is failed (FR-22)."""
        # TODO: implement subquery for latest submission per exercise
        raise NotImplementedError

    async def add_submission(self, **kwargs) -> Submission:  # type: ignore[no-untyped-def]
        sub = Submission(**kwargs)
        self._db.add(sub)
        await self._db.commit()
        await self._db.refresh(sub)
        return sub

    async def mark_disputed(self, exercise_id: int) -> None:
        """Manually mark the latest submission as passed (FR-18)."""
        result = await self._db.execute(
            select(Submission)
            .where(Submission.exercise_id == exercise_id)
            .order_by(Submission.submitted_at.desc())
            .limit(1)
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.passed = True
            sub.disputed = True
            await self._db.commit()
