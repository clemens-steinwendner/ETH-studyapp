from fastapi import APIRouter, status
from app.dependencies import DbSession, BudgetGuard
from app.schemas.session import SessionCreate, SessionOut

router = APIRouter()


@router.post("/", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate, db: DbSession, _: BudgetGuard) -> SessionOut:
    """Create a new study session with the given context and parameters."""
    # TODO: session_service.create_session(db, body)
    raise NotImplementedError


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: int, db: DbSession) -> SessionOut:
    """Retrieve session details and associated exercises."""
    # TODO: session_repo.get_by_id(db, session_id)
    raise NotImplementedError


@router.patch("/{session_id}/exercises/{exercise_id}/dispute", status_code=status.HTTP_200_OK)
async def dispute_grade(session_id: int, exercise_id: int, db: DbSession) -> dict:
    """Manually mark an exercise as passed, overriding the LLM evaluation (FR-18)."""
    # TODO: exercise_repo.mark_passed(db, exercise_id)
    raise NotImplementedError
