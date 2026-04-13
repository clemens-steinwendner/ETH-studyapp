from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import async_session_factory
from app.services.budget_service import BudgetService


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def get_arq_pool(request: Request) -> Any:
    return request.app.state.arq_pool


async def budget_guard(db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    service = BudgetService(db)
    if await service.is_budget_exceeded():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Monthly API budget exceeded. Generative features are disabled.",
        )


DbSession = Annotated[AsyncSession, Depends(get_db)]
ArqPool = Annotated[Any, Depends(get_arq_pool)]
BudgetGuard = Annotated[None, Depends(budget_guard)]
