from fastapi import APIRouter

from app.dependencies import DbSession
from app.schemas.budget import BudgetStatus
from app.services.budget_service import BudgetService

router = APIRouter()


@router.get("/status", response_model=BudgetStatus)
async def get_budget_status(db: DbSession) -> BudgetStatus:
    """Return current month's API spend and whether the budget has been exceeded (FR-23)."""
    return await BudgetService(db).get_status()
