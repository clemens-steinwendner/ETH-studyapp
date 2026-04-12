from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class APIUsageRecord(Base):
    __tablename__ = "api_usage_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    model: Mapped[str] = mapped_column(String(128))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[float] = mapped_column(Float)
