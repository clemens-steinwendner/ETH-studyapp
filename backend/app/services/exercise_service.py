"""
LLM-based exercise and test-case generation (FR-13).

Retrieves relevant context chunks via RAG, then prompts the LLM to produce:
- A question (coding / multiple-choice / open-ended)
- Corresponding deterministic test cases (pytest / SQL assertions / HUnit)
"""
import asyncio
import json
import re
from functools import partial
from pathlib import Path

from fastapi import HTTPException
from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.services.settings_service import get_active_model
from app.llm.client import get_llm_client
from app.llm.parsing import extract_json
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

# ── JSON schemas for each question type ──────────────────────────────────────
# Using json_schema mode on Fireworks AI suppresses chain-of-thought preambles
# that appear with json_object mode.

_SCHEMA_CODING = {
    "type": "json_schema",
    "json_schema": {
        "name": "coding_exercise",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "question_text": {"type": "string"},
                "function_signature": {"type": "string"},
                "test_cases_prompt": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["question_text", "function_signature", "test_cases_prompt", "hint"],
            "additionalProperties": False,
        },
    },
}

_SCHEMA_MULTIPLE_CHOICE = {
    "type": "json_schema",
    "json_schema": {
        "name": "multiple_choice_exercise",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "question_text": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}},
                "correct_index": {"type": "integer"},
                "explanation": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["question_text", "options", "correct_index", "explanation", "hint"],
            "additionalProperties": False,
        },
    },
}

_SCHEMA_OPEN_ENDED = {
    "type": "json_schema",
    "json_schema": {
        "name": "open_ended_exercise",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "question_text": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["question_text", "hint"],
            "additionalProperties": False,
        },
    },
}

_SCHEMA_TEST_CODE = {
    "type": "json_schema",
    "json_schema": {
        "name": "test_cases",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "test_code": {"type": "string"},
            },
            "required": ["test_code"],
            "additionalProperties": False,
        },
    },
}

_QUESTION_SCHEMA_MAP = {
    "coding": _SCHEMA_CODING,
    "multiple_choice": _SCHEMA_MULTIPLE_CHOICE,
    "open_ended": _SCHEMA_OPEN_ENDED,
}


def _split_prompt(text: str) -> tuple[str, str]:
    """Split a prompt file into (system_message, user_message)."""
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""
    user_match = re.split(r"^## System.*?(?=\n## |\Z)", text, maxsplit=1, flags=re.DOTALL)
    user = user_match[-1].strip() if len(user_match) > 1 else text.strip()
    return system, user


async def generate_exercise(db: AsyncSession, body: ExerciseGenerateRequest) -> ExerciseOut:
    """
    Generate a new exercise for the given session.

    For retry sessions (is_retry_session=True): returns the next pre-populated
    failed exercise without any LLM call.

    For normal sessions:
    1. Retrieve top-k context chunks from ChromaDB filtered by session context
    2. Load the appropriate prompt template from prompts/exercise_generation/
    3. Call LLM to generate question (+ test cases for coding)
    4. If hints_enabled, pre-generate a hint via the same LLM
    5. Persist Exercise record to SQLite
    6. Return ExerciseOut (with options and hint populated as appropriate)
    """
    session = await SessionRepository(db).get_by_id(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # ── Pre-generated path: instant DB read ────────────────────────────────
    if session.pre_generated or session.is_retry_session:
        exercise = await ExerciseRepository(db).get_next_unsubmitted(body.session_id)
        if not exercise:
            raise HTTPException(status_code=422, detail="All exercises completed")
        out = ExerciseOut.model_validate(exercise)
        if exercise.question_type == "multiple_choice" and exercise.test_cases:
            mc_meta = json.loads(exercise.test_cases)
            out = out.model_copy(update={"options": mc_meta.get("options", [])})
        return out

    # ── Retry path (legacy): replay pre-populated failed exercises ─────────
    if session.is_retry_session:
        exercise = await ExerciseRepository(db).get_next_unsubmitted(body.session_id)
        if not exercise:
            raise HTTPException(status_code=422, detail="All retry exercises completed")
        out = ExerciseOut.model_validate(exercise)
        if exercise.question_type == "multiple_choice" and exercise.test_cases:
            mc_meta = json.loads(exercise.test_cases)
            out = out.model_copy(update={"options": mc_meta.get("options", [])})
        return out

    # ── Normal generation path ─────────────────────────────────────────────
    model = await get_active_model(db)

    # 1. RAG: retrieve relevant chunks.
    # retrieve_chunks runs sentence-transformer inference synchronously — offload
    # to a thread so we don't block the async event loop.
    topic_str = ", ".join(session.topic_filter or [])
    rag_query = (
        f"Course material about: {topic_str}. "
        f"{session.difficulty.capitalize()} level concepts, definitions, and examples."
    ).strip()
    loop = asyncio.get_event_loop()
    chunks = await loop.run_in_executor(
        None,
        partial(retrieve_chunks, rag_query, session.document_ids, session.chapter_ids, 8),
    )
    context_text = "\n\n---\n\n".join(c.text for c in chunks)

    # 2. Render question prompt
    template_path = _PROMPTS_DIR / _QUESTION_TEMPLATE_MAP[body.question_type]
    rendered = Template(template_path.read_text()).render(
        context_chunks=context_text,
        language=body.language or "python",
        difficulty=session.difficulty,
        selected_topics=session.topic_filter or [],
    )
    system_msg, user_msg = _split_prompt(rendered)

    # 3. Call LLM — use json_schema to suppress chain-of-thought preamble
    client = get_llm_client()
    budget_svc = BudgetService(db)
    schema = _QUESTION_SCHEMA_MAP[body.question_type]

    response_text, in_tok, out_tok = await collect_response(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        response_format=schema,
    )
    await budget_svc.record_usage(model, in_tok, out_tok)

    # 4. Parse LLM response JSON
    parsed = extract_json(response_text)
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
            model=model,
            messages=[
                {"role": "system", "content": ts_system},
                {"role": "user", "content": ts_user},
            ],
            response_format=_SCHEMA_TEST_CODE,
        )
        await budget_svc.record_usage(model, ti, to)
        # Test code is now returned as {"test_code": "..."} — extract the string
        test_parsed = extract_json(tests_text)
        test_cases_str = test_parsed.get("test_code", tests_text) if isinstance(test_parsed, dict) else tests_text

    elif body.question_type == "multiple_choice":
        mc_meta = {
            "options": parsed.get("options", []),
            "correct_index": parsed.get("correct_index", 0),
            "explanation": parsed.get("explanation", ""),
        }
        test_cases_str = json.dumps(mc_meta)
        mc_options = mc_meta["options"]

    # 5. Extract hint from schema response (hint is now co-generated with the question)
    hint_text: str | None = parsed.get("hint") or None if session.hints_enabled else None

    # 6. Persist the exercise
    exercise = await ExerciseRepository(db).create(
        session_id=body.session_id,
        question_type=body.question_type,
        language=body.language,
        question_text=question_text,
        test_cases=test_cases_str,
        hint=hint_text,
    )

    # 7. Build ExerciseOut, injecting options for MC questions + hint
    out = ExerciseOut.model_validate(exercise)
    updates: dict = {}
    if mc_options is not None:
        updates["options"] = mc_options
    if hint_text is not None:
        updates["hint"] = hint_text
    if updates:
        out = out.model_copy(update=updates)
    return out
