from datetime import datetime
from sqlalchemy import String, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    document_ids: Mapped[list] = mapped_column(JSON)         # list[int]
    chapter_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(32))      # recall | application | synthesis
    question_types: Mapped[list] = mapped_column(JSON)       # list[str]
    num_questions: Mapped[int] = mapped_column(default=10)
    hints_enabled: Mapped[bool] = mapped_column(default=True)
    is_retry_session: Mapped[bool] = mapped_column(default=False)

    exercises: Mapped[list["Exercise"]] = relationship(back_populates="session", cascade="all, delete-orphan")  # noqa: F821
