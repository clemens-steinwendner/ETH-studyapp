from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.document import Document, Chapter


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        filename: str,
        subject: str | None = None,
        file_type: str = "other",
    ) -> Document:
        doc = Document(filename=filename, subject=subject, file_type=file_type)
        self._db.add(doc)
        await self._db.commit()
        await self._db.refresh(doc)
        return doc

    async def get_all(self) -> list[Document]:
        result = await self._db.execute(
            select(Document).options(selectinload(Document.chapters))
        )
        return list(result.scalars().all())

    async def get_by_id(self, document_id: int) -> Document | None:
        result = await self._db.execute(
            select(Document)
            .options(selectinload(Document.chapters))
            .where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def list_by_subject(self, subject: str) -> list[Document]:
        result = await self._db.execute(
            select(Document)
            .options(selectinload(Document.chapters))
            .where(Document.subject == subject)
        )
        return list(result.scalars().all())

    async def list_rag_docs_by_subject(self, subject: str) -> list[Document]:
        """Return only RAG-eligible documents for a subject (excludes mock_exam)."""
        result = await self._db.execute(
            select(Document)
            .options(selectinload(Document.chapters))
            .where(Document.subject == subject, Document.file_type != "mock_exam")
        )
        return list(result.scalars().all())

    async def add_chapter(
        self, document_id: int, title: str, page_start: int, page_end: int
    ) -> Chapter:
        chapter = Chapter(
            document_id=document_id,
            title=title,
            page_start=page_start,
            page_end=page_end,
        )
        self._db.add(chapter)
        await self._db.commit()
        await self._db.refresh(chapter)
        return chapter

    async def mark_ingested(self, document_id: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.ingested = True
            await self._db.commit()

    async def mark_unindexed(self, document_id: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.ingested = False
            await self._db.commit()

    async def update(self, document_id: int, **fields) -> Document | None:  # type: ignore[no-untyped-def]
        doc = await self.get_by_id(document_id)
        if not doc:
            return None
        for key, value in fields.items():
            if hasattr(doc, key):
                setattr(doc, key, value)
        await self._db.commit()
        await self._db.refresh(doc)
        return doc

    async def delete(self, document_id: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            await self._db.delete(doc)
            await self._db.commit()
