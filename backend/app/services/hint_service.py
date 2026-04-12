"""
On-demand hint generation (FR-09).

Returns a conceptual nudge — not the answer — to help the user
think through the problem.
"""
from sqlalchemy.ext.asyncio import AsyncSession


async def get_hint(db: AsyncSession, exercise_id: int) -> str:
    """
    Generate a conceptual hint for the given exercise.

    Loads the exercise question and relevant context, then calls the LLM
    with the prompts/hints/conceptual_nudge.md template.
    """
    # TODO: implement
    raise NotImplementedError
