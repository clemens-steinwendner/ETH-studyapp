from fastapi import APIRouter, status
from app.dependencies import DbSession, BudgetGuard
from app.schemas.exercise import ExerciseGenerateRequest, ExerciseOut, SubmissionRequest, SubmissionOut

router = APIRouter()


@router.post("/generate", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def generate_exercise(
    body: ExerciseGenerateRequest, db: DbSession, _: BudgetGuard
) -> ExerciseOut:
    """Generate a new exercise (question + test cases) via LLM for the given session."""
    # TODO: exercise_service.generate(db, body)
    raise NotImplementedError


@router.post("/{exercise_id}/submit", response_model=SubmissionOut)
async def submit_exercise(
    exercise_id: int, body: SubmissionRequest, db: DbSession, _: BudgetGuard
) -> SubmissionOut:
    """Submit an answer. Triggers sandbox execution for code, vision grading for images."""
    # TODO: grading_service.grade(db, exercise_id, body)
    raise NotImplementedError


@router.post("/{exercise_id}/hint", response_model=dict)
async def get_hint(exercise_id: int, db: DbSession, _: BudgetGuard) -> dict:
    """Request a conceptual hint for the given exercise (FR-09)."""
    # TODO: hint_service.get_hint(db, exercise_id)
    raise NotImplementedError
