import json
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models.exam_profile import ExamProfile


class ExamProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_latest_by_subject(self, subject: str) -> ExamProfile | None:
        """Return the most recently created ExamProfile for a subject."""
        result = await self._db.execute(
            select(ExamProfile)
            .where(ExamProfile.subject == subject)
            .order_by(ExamProfile.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        subject: str,
        document_id: int,
        question_type_distribution: dict,
        style_description: str,
        topic_frequency: dict | None = None,
        difficulty_mix: dict | None = None,
        common_traps: list[str] | None = None,
    ) -> ExamProfile:
        """Create a new ExamProfile record."""
        record = ExamProfile(
            subject=subject,
            document_id=document_id,
            question_type_distribution=json.dumps(question_type_distribution),
            style_description=style_description,
            topic_frequency=json.dumps(topic_frequency) if topic_frequency else None,
            difficulty_mix=json.dumps(difficulty_mix) if difficulty_mix else None,
            common_traps=json.dumps(common_traps) if common_traps else None,
            created_at=datetime.utcnow(),
        )
        self._db.add(record)
        await self._db.commit()
        await self._db.refresh(record)
        return record
