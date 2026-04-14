"""
Study session creation and context resolution (FR-07, FR-08).

Session creation now triggers pre-generation: all exercises are planned and
generated before returning to the client. The frontend can then fetch each
question instantly from the database with no per-question LLM wait.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.document_repo import DocumentRepository
from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import SessionCreate, SessionOut
from app.services.session_planner import plan_session
from app.services.session_generator import execute_plan


async def create_session(db: AsyncSession, body: SessionCreate) -> SessionOut:
    """
    Create a new StudySession, then plan and pre-generate all exercises.

    Validates that all selected documents exist and have been fully ingested.
    On generation failure the session record is deleted so the client receives
    a clean 500 rather than an empty/broken session.
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

    try:
        plan = await plan_session(session, db)
        await execute_plan(session, plan, db)
        await session_repo.mark_pre_generated(session.id)
        # Refresh the session object so pre_generated=True is visible in the output
        session = await session_repo.get_by_id(session.id)
    except Exception as exc:
        await session_repo.delete(session.id)
        raise HTTPException(
            status_code=500,
            detail=f"Session generation failed: {exc}",
        ) from exc

    return SessionOut.model_validate(session)
