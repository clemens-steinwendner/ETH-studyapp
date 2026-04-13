"""
Study session creation and context resolution (FR-07, FR-08).
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.document_repo import DocumentRepository
from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import SessionCreate, SessionOut


async def create_session(db: AsyncSession, body: SessionCreate) -> SessionOut:
    """
    Create a new StudySession record.

    Validates that all selected documents exist and have been fully ingested
    before creating the session. Resolves the selected document / chapter IDs
    into a context boundary used for RAG retrieval during exercise generation.
    """
    doc_repo = DocumentRepository(db)
    for doc_id in body.document_ids:
        doc = await doc_repo.get_by_id(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        if not doc.ingested:
            raise HTTPException(
                status_code=422,
                detail=f"Document {doc_id} has not finished ingestion yet",
            )

    session_repo = SessionRepository(db)
    session = await session_repo.create(**body.model_dump())
    return SessionOut.model_validate(session)
