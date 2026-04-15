"""
Session generator: execute a SessionPlan by calling the LLM for each QuestionSpec
and persisting exercises to the database in slot order.

Hints are co-generated with the question (same LLM call, same JSON schema) — no
separate hint call. Previously-asked questions within the same topic are passed as
diversity context to avoid repetition.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.session import StudySession
from app.db.repositories.exercise_repo import ExerciseRepository
from app.llm.client import get_llm_client
from app.llm.parsing import extract_json
from app.llm.streaming import collect_response
from app.services.budget_service import BudgetService
from app.services.session_planner import SessionPlan
from app.services.settings_service import get_active_model
from jinja2 import Template

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"

_QUESTION_TEMPLATE_MAP = {
    "coding": "exercise_generation/coding_question.md",
    "multiple_choice": "exercise_generation/multiple_choice.md",
    "open_ended": "exercise_generation/open_ended.md",
    "true_false": "exercise_generation/true_false.md",
    "multiple_select": "exercise_generation/multiple_select.md",
}

_TEST_TEMPLATE_MAP = {
    "python": "test_generation/python_tests.md",
    "sql": "test_generation/sql_tests.md",
    "haskell": "test_generation/haskell_tests.md",
}

# JSON schemas — hint is required in all three so it's co-generated with the question

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
                "explanation": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["question_text", "explanation", "hint"],
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

_SCHEMA_TRUE_FALSE = {
    "type": "json_schema",
    "json_schema": {
        "name": "true_false_exercise",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "statement": {"type": "string"},
                "correct_answer": {"type": "boolean"},
                "explanation": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["statement", "correct_answer", "explanation", "hint"],
            "additionalProperties": False,
        },
    },
}

_SCHEMA_MULTIPLE_SELECT = {
    "type": "json_schema",
    "json_schema": {
        "name": "multiple_select_exercise",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "question_text": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}},
                "correct_indices": {"type": "array", "items": {"type": "integer"}},
                "explanation": {"type": "string"},
                "hint": {"type": "string"},
            },
            "required": ["question_text", "options", "correct_indices", "explanation", "hint"],
            "additionalProperties": False,
        },
    },
}

_QUESTION_SCHEMA_MAP = {
    "coding": _SCHEMA_CODING,
    "multiple_choice": _SCHEMA_MULTIPLE_CHOICE,
    "open_ended": _SCHEMA_OPEN_ENDED,
    "true_false": _SCHEMA_TRUE_FALSE,
    "multiple_select": _SCHEMA_MULTIPLE_SELECT,
}


def _split_prompt(text: str) -> tuple[str, str]:
    """Split a prompt file into (system_message, user_message)."""
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""
    user_match = re.split(r"^## System.*?(?=\n## |\Z)", text, maxsplit=1, flags=re.DOTALL)
    user = user_match[-1].strip() if len(user_match) > 1 else text.strip()
    return system, user


@dataclass
class _GeneratedExercise:
    slot: int
    question_type: str
    language: str | None
    question_text: str
    test_cases: str | None
    hint: str | None


async def execute_plan(
    session: StudySession,
    plan: SessionPlan,
    db: AsyncSession,
) -> None:
    """
    Generate all exercises defined in *plan* and persist them to the database.

    Processing order: iterate topics so that within each topic, previously-asked
    questions can be passed as diversity context. Exercises are then inserted in
    slot order so the user sees an interleaved sequence (not all questions from
    one topic in a row).
    """
    client = get_llm_client()
    model = await get_active_model(db)
    budget_svc = BudgetService(db)
    generated: dict[int, _GeneratedExercise] = {}

    for topic, topic_specs in plan.by_topic.items():
        previously_asked: list[str] = []

        for spec in topic_specs:
            # 1. Render question prompt
            template_path = _PROMPTS_DIR / _QUESTION_TEMPLATE_MAP[spec.question_type]
            rendered = Template(template_path.read_text()).render(
                context_chunks=spec.context_text,
                language=spec.language or "python",
                difficulty=session.difficulty,
                selected_topics=[spec.topic],
                previously_asked=previously_asked,
                style_guidance=plan.style_guidance,
            )
            system_msg, user_msg = _split_prompt(rendered)

            # 2. LLM call — question + hint in one schema
            schema = _QUESTION_SCHEMA_MAP[spec.question_type]
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

            parsed = extract_json(response_text)
            # true_false uses "statement" as the question text field
            question_text: str = (
                parsed.get("statement") or parsed.get("question_text") or response_text.strip()
            )
            hint_text: str | None = parsed.get("hint") or None if session.hints_enabled else None
            test_cases_str: str | None = None

            # 3. Post-process per question type
            if spec.question_type == "coding":
                lang = spec.language or "python"
                test_template_path = _PROMPTS_DIR / _TEST_TEMPLATE_MAP.get(
                    lang, "test_generation/python_tests.md"
                )
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
                test_parsed = extract_json(tests_text)
                test_cases_str = (
                    test_parsed.get("test_code", tests_text)
                    if isinstance(test_parsed, dict)
                    else tests_text
                )

            elif spec.question_type == "multiple_choice":
                mc_meta = {
                    "options": parsed.get("options", []),
                    "correct_index": parsed.get("correct_index", 0),
                    "explanation": parsed.get("explanation", ""),
                }
                test_cases_str = json.dumps(mc_meta)

            elif spec.question_type == "true_false":
                tf_meta = {
                    "correct_answer": parsed.get("correct_answer", False),
                    "explanation": parsed.get("explanation", ""),
                }
                test_cases_str = json.dumps(tf_meta)

            elif spec.question_type == "multiple_select":
                ms_meta = {
                    "options": parsed.get("options", []),
                    "correct_indices": parsed.get("correct_indices", []),
                    "explanation": parsed.get("explanation", ""),
                }
                test_cases_str = json.dumps(ms_meta)

            elif spec.question_type == "open_ended":
                oe_meta = {"explanation": parsed.get("explanation", "")}
                test_cases_str = json.dumps(oe_meta)

            generated[spec.slot] = _GeneratedExercise(
                slot=spec.slot,
                question_type=spec.question_type,
                language=spec.language,
                question_text=question_text,
                test_cases=test_cases_str,
                hint=hint_text,
            )
            previously_asked.append(question_text)

    # 4. Insert in slot order so get_next_unsubmitted returns them in sequence
    exercise_repo = ExerciseRepository(db)
    for slot in sorted(generated.keys()):
        ex = generated[slot]
        await exercise_repo.create(
            session_id=session.id,
            question_type=ex.question_type,
            language=ex.language,
            question_text=ex.question_text,
            test_cases=ex.test_cases,
            hint=ex.hint,
        )
