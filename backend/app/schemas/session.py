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
    topic_filter: list[str] | None = None

    model_config = {"from_attributes": True}
