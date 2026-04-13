import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.config import settings
from app.dependencies import DbSession, BudgetGuard
from app.schemas.exercise import ExerciseGenerateRequest, ExerciseOut, SubmissionRequest, SubmissionOut
from app.services import exercise_service, grading_service, hint_service

router = APIRouter()


@router.post("/generate", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def generate_exercise(
    body: ExerciseGenerateRequest, db: DbSession, _: BudgetGuard
) -> ExerciseOut:
    """Generate a new exercise (question + test cases) via LLM for the given session."""
    return await exercise_service.generate_exercise(db, body)


@router.post("/{exercise_id}/submit", response_model=SubmissionOut)
async def submit_exercise(
    exercise_id: int, body: SubmissionRequest, db: DbSession, _: BudgetGuard
) -> SubmissionOut:
    """Submit a text or code answer. Triggers sandbox execution for coding, LLM for open-ended."""
    return await grading_service.grade_submission(db, exercise_id, body)


@router.post("/{exercise_id}/submit/image", response_model=SubmissionOut)
async def submit_image(
    exercise_id: int,
    file: UploadFile,
    db: DbSession,
    _: BudgetGuard,
) -> SubmissionOut:
    """Upload a handwritten proof image and grade it via Vision LLM (FR-17)."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "proof.png").suffix or ".png"
    dest = upload_dir / f"{uuid.uuid4()}{suffix}"
    dest.write_bytes(await file.read())

    body = SubmissionRequest(answer_text=None, answer_image_path=str(dest))
    return await grading_service.grade_submission(db, exercise_id, body)


@router.post("/{exercise_id}/hint")
async def get_hint(exercise_id: int, db: DbSession, _: BudgetGuard) -> dict:
    """Request a conceptual hint for the given exercise (FR-09)."""
    hint = await hint_service.get_hint(db, exercise_id)
    return {"hint": hint}
