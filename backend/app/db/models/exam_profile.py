from datetime import datetime
from sqlalchemy import String, DateTime, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExamProfile(Base):
    """Style and question-type profile extracted from a mock exam document."""

    __tablename__ = "exam_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"), nullable=False)
    # JSON: {"true_false": 0.35, "multiple_choice": 0.40, ...}
    question_type_distribution: Mapped[str] = mapped_column(Text, nullable=False)
    style_description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
