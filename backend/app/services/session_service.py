"""
Study session creation and context resolution (FR-07, FR-08).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.session import SessionCreate, SessionOut


async def create_session(db: AsyncSession, body: SessionCreate) -> SessionOut:
    """
    Create a new StudySession record.

    Resolves the selected document IDs / chapter IDs into a context boundary
    used for RAG retrieval during exercise generation.
    """
    # TODO: implement
    raise NotImplementedError
