import json
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models.topic_list import SubjectTopicList


class TopicRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_subject(self, subject: str) -> SubjectTopicList | None:
        result = await self._db.execute(
            select(SubjectTopicList).where(SubjectTopicList.subject == subject)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        subject: str,
        topics: list[dict],
        source_doc_ids: list[int],
    ) -> SubjectTopicList:
        existing = await self.get_by_subject(subject)
        if existing:
            existing.topics_json = json.dumps(topics)
            existing.generated_at = datetime.utcnow()
            existing.source_doc_ids = json.dumps(source_doc_ids)
            await self._db.commit()
            await self._db.refresh(existing)
            return existing

        record = SubjectTopicList(
            subject=subject,
            topics_json=json.dumps(topics),
            generated_at=datetime.utcnow(),
            source_doc_ids=json.dumps(source_doc_ids),
        )
        self._db.add(record)
        await self._db.commit()
        await self._db.refresh(record)
        return record

    async def delete(self, subject: str) -> None:
        existing = await self.get_by_subject(subject)
        if existing:
            await self._db.delete(existing)
            await self._db.commit()
