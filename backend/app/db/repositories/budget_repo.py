from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.models.budget import APIUsageRecord


class BudgetRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add_record(self, model: str, input_tokens: int, output_tokens: int, cost_usd: float) -> None:
        record = APIUsageRecord(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )
        self._db.add(record)
        await self._db.commit()

    async def get_current_month_total(self) -> float:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = await self._db.execute(
            select(func.coalesce(func.sum(APIUsageRecord.cost_usd), 0.0))
            .where(APIUsageRecord.recorded_at >= month_start)
        )
        return float(result.scalar_one())
