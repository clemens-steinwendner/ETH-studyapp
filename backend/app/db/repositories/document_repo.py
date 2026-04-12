from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models.document import Document, Chapter


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, filename: str) -> Document:
        doc = Document(filename=filename)
        self._db.add(doc)
        await self._db.commit()
        await self._db.refresh(doc)
        return doc

    async def get_all(self) -> list[Document]:
        result = await self._db.execute(select(Document))
        return list(result.scalars().all())

    async def get_by_id(self, document_id: int) -> Document | None:
        return await self._db.get(Document, document_id)

    async def mark_ingested(self, document_id: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.ingested = True
            await self._db.commit()

    async def delete(self, document_id: int) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            await self._db.delete(doc)
            await self._db.commit()
