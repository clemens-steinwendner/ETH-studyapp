from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import async_session_factory
from app.services.budget_service import BudgetService


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def budget_guard(db: DbSession) -> None:
    service = BudgetService(db)
    if await service.is_budget_exceeded():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Monthly API budget exceeded. Generative features are disabled.",
        )


BudgetGuard = Annotated[None, Depends(budget_guard)]
