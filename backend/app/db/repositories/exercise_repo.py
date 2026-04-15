from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

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
        # Correlated subquery: MAX(submission.id) per exercise = the latest submission
        latest_sub = (
            select(func.max(Submission.id))
            .where(Submission.exercise_id == Exercise.id)
            .correlate(Exercise)
            .scalar_subquery()
        )
        stmt = (
            select(Exercise)
            .join(Submission, Submission.id == latest_sub)
            .where(Submission.passed == False, Submission.disputed == False)  # noqa: E712
        )
        if session_ids:
            stmt = stmt.where(Exercise.session_id.in_(session_ids))
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_session(self, session_id: int) -> list[Exercise]:
        """Return all exercises for a session ordered by creation time."""
        result = await self._db.execute(
            select(Exercise)
            .where(Exercise.session_id == session_id)
            .order_by(Exercise.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_next_unsubmitted(self, session_id: int) -> Exercise | None:
        """Return the first exercise in the session that has no submission (for retry sessions)."""
        stmt = (
            select(Exercise)
            .where(
                Exercise.session_id == session_id,
                ~Exercise.id.in_(select(Submission.exercise_id).scalar_subquery()),
            )
            .order_by(Exercise.id.asc())
            .limit(1)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def add_submission(self, **kwargs) -> Submission:  # type: ignore[no-untyped-def]
        sub = Submission(**kwargs)
        self._db.add(sub)
        await self._db.commit()
        await self._db.refresh(sub)
        return sub

    async def mark_disputed(self, exercise_id: int) -> Submission | None:
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
            await self._db.refresh(sub)
        return sub
