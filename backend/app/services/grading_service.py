"""
Exercise grading (FR-15, FR-17).

- Code submissions: deterministic — reads sandbox exit code only, no LLM (FR-15)
- Image submissions (handwritten proofs): Vision LLM evaluation (FR-17)
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.exercise import SubmissionRequest, SubmissionOut


async def grade_submission(
    db: AsyncSession, exercise_id: int, body: SubmissionRequest
) -> SubmissionOut:
    """
    Grade a user submission.

    Routes to the appropriate grader based on submission type:
    - 'code'  → sandbox_service.run() → pass/fail from exit code
    - 'image' → llm.vision.grade_proof() → structured feedback
    - 'text'  → llm text evaluation
    """
    # TODO: implement routing logic
    raise NotImplementedError
