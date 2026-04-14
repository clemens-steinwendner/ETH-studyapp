"""
On-demand hint generation (FR-09).

Returns a conceptual nudge — not the answer — to help the user
think through the problem.
"""
from pathlib import Path

from fastapi import HTTPException
from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.services.settings_service import get_active_model
from app.llm.client import get_llm_client
from app.llm.streaming import collect_response
from app.services.budget_service import BudgetService
from app.vector_db.retriever import retrieve_chunks

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"


async def get_hint(db: AsyncSession, exercise_id: int) -> str:
    """
    Generate a conceptual hint for the given exercise.

    Retrieves the top-3 most relevant context chunks, then calls the LLM
    with the prompts/hints/conceptual_nudge.md template to produce a nudge
    that points the student toward the right approach without revealing
    the answer.
    """
    exercise = await ExerciseRepository(db).get_by_id(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    session = await SessionRepository(db).get_by_id(exercise.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    chunks = retrieve_chunks(
        query=exercise.question_text[:200],
        document_ids=session.document_ids,
        chapter_ids=session.chapter_ids,
        top_k=3,
    )
    context_text = "\n\n".join(c.text for c in chunks)

    prompt_path = _PROMPTS_DIR / "hints" / "conceptual_nudge.md"
    rendered = Template(prompt_path.read_text()).render(
        question_text=exercise.question_text,
        context_chunks=context_text,
    )

    model = await get_active_model(db)
    client = get_llm_client()
    hint, in_tok, out_tok = await collect_response(
        client,
        model=model,
        messages=[{"role": "user", "content": rendered}],
    )
    await BudgetService(db).record_usage(model, in_tok, out_tok)
    return hint.strip()
