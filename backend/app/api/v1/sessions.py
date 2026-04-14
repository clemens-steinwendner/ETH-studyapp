from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.dependencies import DbSession
from app.schemas.exercise import SubmissionOut
from app.schemas.session import SessionCreate, SessionOut
from app.services import session_service
from app.services import spaced_repetition

router = APIRouter()


class RetryRequest(BaseModel):
    source_session_ids: list[int] | None = None


@router.post("/", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate, db: DbSession) -> SessionOut:
    """Create a new study session with the given context and parameters."""
    return await session_service.create_session(db, body)


@router.get("/", response_model=list[SessionOut])
async def list_sessions(db: DbSession) -> list[SessionOut]:
    """List all past study sessions, newest first, with pass/fail counts."""
    rows = await SessionRepository(db).get_all_with_counts()
    result: list[SessionOut] = []
    for session, pass_count, fail_count in rows:
        out = SessionOut.model_validate(session)
        out.pass_count = pass_count
        out.fail_count = fail_count
        result.append(out)
    return result


@router.post("/retry", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def retry_session(body: RetryRequest, db: DbSession) -> SessionOut:
    """Create a new session comprised exclusively of previously failed exercises (FR-22)."""
    return await spaced_repetition.create_retry_session(db, body.source_session_ids)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: int, db: DbSession) -> None:
    """Delete a study session and all its exercises and submissions."""
    await SessionRepository(db).delete(session_id)


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: int, db: DbSession) -> SessionOut:
    """Retrieve session details and associated exercises."""
    session = await SessionRepository(db).get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionOut.model_validate(session)


@router.patch(
    "/{session_id}/exercises/{exercise_id}/dispute",
    response_model=SubmissionOut,
    status_code=status.HTTP_200_OK,
)
async def dispute_grade(session_id: int, exercise_id: int, db: DbSession) -> SubmissionOut:
    """Manually mark an exercise as passed, overriding the LLM evaluation (FR-18)."""
    submission = await ExerciseRepository(db).mark_disputed(exercise_id)
    if not submission:
        raise HTTPException(status_code=404, detail="No submission found for this exercise")
    return SubmissionOut.model_validate(submission)
