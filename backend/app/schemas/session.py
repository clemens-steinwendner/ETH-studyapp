from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


DifficultyLevel = Literal["recall", "application", "synthesis"]
QuestionType = Literal["coding", "multiple_choice", "open_ended"]


class SessionCreate(BaseModel):
    document_ids: list[int]
    chapter_ids: list[int] | None = None
    difficulty: DifficultyLevel = "application"
    question_types: list[QuestionType] = Field(default_factory=lambda: ["coding", "multiple_choice", "open_ended"])
    num_questions: int = Field(default=10, ge=1, le=50)
    hints_enabled: bool = True
    exam_mode: bool = False
    topic_filter: list[str] | None = None  # Optional list of topic titles to focus on


class SessionOut(BaseModel):
    id: int
    created_at: datetime
    document_ids: list[int]
    chapter_ids: list[int] | None
    difficulty: str
    question_types: list[str]
    num_questions: int
    hints_enabled: bool
    is_retry_session: bool
    exam_mode: bool
    pre_generated: bool = False
    topic_filter: list[str] | None = None
    pass_count: int | None = None
    fail_count: int | None = None

    model_config = {"from_attributes": True}
