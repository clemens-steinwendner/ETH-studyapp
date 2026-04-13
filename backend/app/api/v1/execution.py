from fastapi import APIRouter

from app.db.repositories.exercise_repo import ExerciseRepository
from app.dependencies import DbSession, BudgetGuard
from app.schemas.execution import ExecutionRequest, ExecutionResult
from app.services import sandbox_service

router = APIRouter()


@router.post("/", response_model=ExecutionResult)
async def execute_code(body: ExecutionRequest, db: DbSession, _: BudgetGuard) -> ExecutionResult:
    """
    Bundle user code with generated test cases and run in E2B sandbox (FR-14).

    This is the 'Run' button endpoint — executes without recording a Submission.
    If test_cases is omitted, they are fetched from the exercise record.
    """
    # Fetch exercise to fill in missing language / test_cases
    if not body.test_cases or not body.language:
        exercise = await ExerciseRepository(db).get_by_id(body.exercise_id)
        if exercise:
            body = ExecutionRequest(
                exercise_id=body.exercise_id,
                language=body.language or exercise.language or "python",
                user_code=body.user_code,
                test_cases=body.test_cases or exercise.test_cases or "",
            )

    return await sandbox_service.run_in_sandbox(body)
