"""
API cost tracking and $8/month budget enforcement (FR-23).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.budget_repo import BudgetRepository
from app.schemas.budget import BudgetStatus


class BudgetService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = BudgetRepository(db)

    async def is_budget_exceeded(self) -> bool:
        current_spend = await self._repo.get_current_month_total()
        return current_spend >= settings.monthly_budget_usd

    async def get_status(self) -> BudgetStatus:
        current_spend = await self._repo.get_current_month_total()
        return BudgetStatus(
            spent_usd=current_spend,
            limit_usd=settings.monthly_budget_usd,
            exceeded=current_spend >= settings.monthly_budget_usd,
        )

    async def record_usage(self, model: str, input_tokens: int, output_tokens: int) -> None:
        from app.llm.cost_calculator import calculate_cost
        cost = calculate_cost(model, input_tokens, output_tokens)
        await self._repo.add_record(model=model, input_tokens=input_tokens,
                                    output_tokens=output_tokens, cost_usd=cost)
