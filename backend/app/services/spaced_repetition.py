"""
Spaced repetition: generate a retry session from previously failed exercises (FR-22).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.session import SessionOut


async def create_retry_session(db: AsyncSession, source_session_ids: list[int] | None = None) -> SessionOut:
    """
    Create a new session populated exclusively with exercises marked as Failed.

    If source_session_ids is provided, only failed exercises from those sessions
    are included. Otherwise all historical failures are eligible.
    """
    # TODO: query exercise_repo for failed exercises, create new session
    raise NotImplementedError
