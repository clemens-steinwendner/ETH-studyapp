from typing import Literal
from pydantic import BaseModel


class ExecutionRequest(BaseModel):
    exercise_id: int
    language: Literal["python", "sql", "haskell"]
    user_code: str
    test_cases: str


class ExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    passed: bool
    duration_ms: float
