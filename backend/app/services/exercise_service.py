"""
LLM-based exercise and test-case generation (FR-13).

Retrieves relevant context chunks via RAG, then prompts the LLM to produce:
- A question (coding / multiple-choice / open-ended)
- Corresponding deterministic test cases (pytest / SQL assertions / HUnit)
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.exercise import ExerciseGenerateRequest, ExerciseOut


async def generate_exercise(db: AsyncSession, body: ExerciseGenerateRequest) -> ExerciseOut:
    """
    Generate a new exercise for the given session.

    Steps:
    1. Retrieve top-k context chunks from ChromaDB filtered by session context
    2. Load the appropriate prompt template from prompts/exercise_generation/
    3. Call LLM (streaming via WebSocket) to generate question + test cases
    4. Persist Exercise record to SQLite
    5. Return ExerciseOut
    """
    # TODO: implement
    raise NotImplementedError
