from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    question_type: Mapped[str] = mapped_column(String(32))   # coding | multiple_choice | open_ended
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)  # python | sql | haskell
    question_text: Mapped[str] = mapped_column(Text)
    test_cases: Mapped[str | None] = mapped_column(Text, nullable=True)      # generated test code
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)            # pre-generated hint (FR-09)
    sources: Mapped[list | None] = mapped_column(JSON, nullable=True)        # [{document_id, chapter_id, page}]

    session: Mapped["StudySession"] = relationship(back_populates="exercises")  # noqa: F821
    submissions: Mapped[list["Submission"]] = relationship(back_populates="exercise", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    disputed: Mapped[bool] = mapped_column(Boolean, default=False)  # FR-18
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    exercise: Mapped["Exercise"] = relationship(back_populates="submissions")
