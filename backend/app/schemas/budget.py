from pydantic import BaseModel


class BudgetStatus(BaseModel):
    spent_usd: float
    limit_usd: float
    exceeded: bool
    remaining_usd: float = 0.0

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        self.remaining_usd = max(0.0, self.limit_usd - self.spent_usd)
