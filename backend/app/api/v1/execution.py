from fastapi import APIRouter
from app.dependencies import DbSession, BudgetGuard
from app.schemas.execution import ExecutionRequest, ExecutionResult

router = APIRouter()


@router.post("/", response_model=ExecutionResult)
async def execute_code(body: ExecutionRequest, db: DbSession, _: BudgetGuard) -> ExecutionResult:
    """Bundle user code with generated test cases and run in E2B sandbox (FR-14)."""
    # TODO: sandbox_service.run(body)
    raise NotImplementedError
