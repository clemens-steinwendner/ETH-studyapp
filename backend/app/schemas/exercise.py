from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class ExerciseGenerateRequest(BaseModel):
    session_id: int
    question_type: Literal["coding", "multiple_choice", "open_ended"]
    language: Literal["python", "sql", "haskell"] | None = None


class ExerciseOut(BaseModel):
    id: int
    session_id: int
    created_at: datetime
    question_type: str
    language: str | None
    question_text: str
    options: list[str] | None = None  # populated for multiple_choice exercises
    hint: str | None = None           # pre-generated hint; None if hints_enabled=False

    model_config = {"from_attributes": True}


class SubmissionRequest(BaseModel):
    answer_text: str | None = None
    answer_image_path: str | None = None  # path to uploaded image in data/uploads/


class SubmissionOut(BaseModel):
    id: int
    exercise_id: int
    passed: bool
    disputed: bool
    feedback: str | None

    model_config = {"from_attributes": True}
