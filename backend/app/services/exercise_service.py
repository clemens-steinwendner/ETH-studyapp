"""
LLM-based exercise and test-case generation (FR-13).

Retrieves relevant context chunks via RAG, then prompts the LLM to produce:
- A question (coding / multiple-choice / open-ended)
- Corresponding deterministic test cases (pytest / SQL assertions / HUnit)
"""
import json
import re
from pathlib import Path

from fastapi import HTTPException
from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.llm.client import get_llm_client
from app.llm.streaming import collect_response
from app.schemas.exercise import ExerciseGenerateRequest, ExerciseOut
from app.services.budget_service import BudgetService
from app.vector_db.retriever import retrieve_chunks

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"

_QUESTION_TEMPLATE_MAP = {
    "coding": "exercise_generation/coding_question.md",
    "multiple_choice": "exercise_generation/multiple_choice.md",
    "open_ended": "exercise_generation/open_ended.md",
}

_TEST_TEMPLATE_MAP = {
    "python": "test_generation/python_tests.md",
    "sql": "test_generation/sql_tests.md",
    "haskell": "test_generation/haskell_tests.md",
}


def _split_prompt(text: str) -> tuple[str, str]:
    """Split a prompt file into (system_message, user_message).

    Extracts the content under '## System' as the system message.
    The remainder of the rendered template is used as the user message.
    """
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""
    # User message: everything after the first non-System heading
    user_match = re.split(r"^## System.*?(?=\n## |\Z)", text, maxsplit=1, flags=re.DOTALL)
    user = user_match[-1].strip() if len(user_match) > 1 else text.strip()
    return system, user


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response."""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return {}


def _strip_code_fence(text: str) -> str:
    """Remove leading/trailing ``` fences from LLM code output."""
    text = text.strip()
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


async def generate_exercise(db: AsyncSession, body: ExerciseGenerateRequest) -> ExerciseOut:
    """
    Generate a new exercise for the given session.

    Steps:
    1. Retrieve top-k context chunks from ChromaDB filtered by session context
    2. Load the appropriate prompt template from prompts/exercise_generation/
    3. Call LLM to generate question (+ test cases for coding)
    4. Persist Exercise record to SQLite
    5. Return ExerciseOut (with options populated for multiple_choice)
    """
    session = await SessionRepository(db).get_by_id(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. RAG: retrieve relevant chunks for context
    rag_query = f"{body.question_type} {body.language or ''} {session.difficulty}".strip()
    chunks = retrieve_chunks(
        query=rag_query,
        document_ids=session.document_ids,
        chapter_ids=session.chapter_ids,
        top_k=8,
    )
    context_text = "\n\n---\n\n".join(c.text for c in chunks)

    # 2. Render question prompt
    template_path = _PROMPTS_DIR / _QUESTION_TEMPLATE_MAP[body.question_type]
    rendered = Template(template_path.read_text()).render(
        context_chunks=context_text,
        language=body.language or "python",
        difficulty=session.difficulty,
    )
    system_msg, user_msg = _split_prompt(rendered)

    # 3. Call LLM for question generation
    client = get_llm_client()
    budget_svc = BudgetService(db)

    response_text, in_tok, out_tok = await collect_response(
        client,
        model=settings.fireworks_model,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
    )
    await budget_svc.record_usage(settings.fireworks_model, in_tok, out_tok)

    # 4. Parse LLM response JSON
    parsed = _extract_json(response_text)
    question_text: str = parsed.get("question_text") or response_text.strip()
    test_cases_str: str | None = None
    mc_options: list[str] | None = None

    if body.question_type == "coding":
        # Generate deterministic test cases with a second LLM call (FR-13)
        lang = body.language or "python"
        test_template_path = _PROMPTS_DIR / _TEST_TEMPLATE_MAP.get(lang, "test_generation/python_tests.md")
        test_rendered = Template(test_template_path.read_text()).render(
            question_text=question_text,
            function_signature=parsed.get("function_signature", ""),
            schema_description=parsed.get("schema_description", ""),
        )
        ts_system, ts_user = _split_prompt(test_rendered)
        tests_text, ti, to = await collect_response(
            client,
            model=settings.fireworks_model,
            messages=[
                {"role": "system", "content": ts_system},
                {"role": "user", "content": ts_user},
            ],
        )
        await budget_svc.record_usage(settings.fireworks_model, ti, to)
        test_cases_str = _strip_code_fence(tests_text)

    elif body.question_type == "multiple_choice":
        # Store options + correct_index as JSON in the test_cases field
        mc_meta = {
            "options": parsed.get("options", []),
            "correct_index": parsed.get("correct_index", 0),
            "explanation": parsed.get("explanation", ""),
        }
        test_cases_str = json.dumps(mc_meta)
        mc_options = mc_meta["options"]

    # 5. Persist the exercise
    exercise = await ExerciseRepository(db).create(
        session_id=body.session_id,
        question_type=body.question_type,
        language=body.language,
        question_text=question_text,
        test_cases=test_cases_str,
    )

    # 6. Build ExerciseOut, injecting options for MC questions
    out = ExerciseOut.model_validate(exercise)
    if mc_options is not None:
        out = out.model_copy(update={"options": mc_options})
    return out
