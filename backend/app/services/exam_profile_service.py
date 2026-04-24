"""
Exam profile extraction (per subject).

When a mock exam document is ingested, this service analyzes its content via
LLM to extract:
  - Question type distribution (what fraction of questions are T/F, MC, multi-select, etc.)
  - Style description (notation style, scenario framing, phrasing patterns)

The result is stored in ExamProfile and used at session generation time to
guide the LLM toward exam-appropriate question styles and types.
"""
import asyncio
import json
import logging
import re
from functools import partial
from pathlib import Path

from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.exam_profile_repo import ExamProfileRepository
from app.llm.client import get_llm_client
from app.llm.parsing import extract_json
from app.llm.streaming import collect_response
from app.services.budget_service import BudgetService
from app.services.settings_service import get_active_model
from app.vector_db.retriever import retrieve_chunks

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"

_SCHEMA_EXAM_PROFILE = {
    "type": "json_schema",
    "json_schema": {
        "name": "exam_profile",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "question_type_distribution": {
                    "type": "object",
                    "properties": {
                        "true_false": {"type": "number"},
                        "multiple_choice": {"type": "number"},
                        "multiple_select": {"type": "number"},
                        "open_ended": {"type": "number"},
                        "numerical": {"type": "number"},
                        "coding": {"type": "number"},
                    },
                    "additionalProperties": False,
                    "required": [],
                },
                "style_description": {"type": "string"},
                # topic_frequency uses additionalProperties so the LLM can emit any topic key
                "topic_frequency": {
                    "type": "object",
                    "additionalProperties": {"type": "number"},
                },
                "difficulty_mix": {
                    "type": "object",
                    "properties": {
                        "recall": {"type": "number"},
                        "application": {"type": "number"},
                        "synthesis": {"type": "number"},
                    },
                    "additionalProperties": False,
                    "required": [],
                },
                "common_traps": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": [
                "question_type_distribution",
                "style_description",
                "topic_frequency",
                "difficulty_mix",
                "common_traps",
            ],
            "additionalProperties": False,
        },
    },
}


def _split_prompt(text: str) -> tuple[str, str]:
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""
    parts = re.split(r"^## System.*?(?=\n## |\Z)", text, maxsplit=1, flags=re.DOTALL)
    user = parts[-1].strip() if len(parts) > 1 else text.strip()
    return system, user


async def extract_exam_profile(
    db: AsyncSession,
    document_id: int,
    subject: str,
) -> None:
    """
    Extract question style and type distribution from a mock exam document.

    Retrieves top-30 RAG chunks from the document, calls LLM with the
    exam_profile_extractor prompt, and persists the result as an ExamProfile.

    Silently skips on any error so ingestion is never blocked.
    """
    try:
        loop = asyncio.get_event_loop()
        chunks = await loop.run_in_executor(
            None,
            partial(
                retrieve_chunks,
                "exam questions, question types, true/false, multiple choice, open-ended problems",
                [document_id],
                None,
                30,
            ),
        )
        if not chunks:
            logger.warning(
                "No chunks found for document_id=%d; skipping exam profile extraction", document_id
            )
            return

        context_text = "\n\n---\n\n".join(c.text for c in chunks)

        template_path = _PROMPTS_DIR / "ingestion" / "exam_profile_extractor.md"
        rendered = Template(template_path.read_text()).render(context_chunks=context_text)
        system_msg, user_msg = _split_prompt(rendered)

        model = await get_active_model(db)
        client = get_llm_client()
        budget_svc = BudgetService(db)

        response_text, in_tok, out_tok = await collect_response(
            client,
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            response_format=_SCHEMA_EXAM_PROFILE,
        )
        await budget_svc.record_usage(model, in_tok, out_tok)

        parsed = extract_json(response_text)
        if not isinstance(parsed, dict):
            logger.warning(
                "Exam profile extraction returned non-dict for document_id=%d", document_id
            )
            return

        distribution = parsed.get("question_type_distribution", {})
        style = parsed.get("style_description", "")
        topic_frequency = parsed.get("topic_frequency", {}) or {}
        difficulty_mix = parsed.get("difficulty_mix", {}) or {}
        common_traps = parsed.get("common_traps", []) or []

        if not distribution or not style:
            logger.warning(
                "Incomplete exam profile for document_id=%d: dist=%r, style=%r",
                document_id, distribution, style,
            )
            return

        await ExamProfileRepository(db).create(
            subject=subject,
            document_id=document_id,
            question_type_distribution=distribution,
            style_description=style,
            topic_frequency=topic_frequency,
            difficulty_mix=difficulty_mix,
            common_traps=common_traps,
        )
        logger.info(
            "Exam profile extracted for subject='%s' (document_id=%d): %s",
            subject, document_id, json.dumps(distribution),
        )

    except Exception:
        logger.exception(
            "Exam profile extraction failed for subject='%s', document_id=%d", subject, document_id
        )
