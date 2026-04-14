"""
Topic list generation and management (per subject).

A topic list is a structured outline of topics and subtopics extracted from
the script documents for a given subject. It is generated once automatically
when a script is ingested and can be regenerated or manually edited at any time.

Topics are stored persistently in SQLite and survive app restarts.
"""
import asyncio
import json
import logging
import re
from functools import partial
from pathlib import Path

from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.document_repo import DocumentRepository
from app.services.settings_service import get_active_model
from app.db.repositories.topic_repo import TopicRepository
from app.db.models.topic_list import SubjectTopicList
from app.llm.client import get_llm_client
from app.llm.parsing import extract_json
from app.llm.streaming import collect_response
from app.services.budget_service import BudgetService
from app.vector_db.retriever import retrieve_chunks

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"


def _split_prompt(text: str) -> tuple[str, str]:
    """Split a prompt template into (system_message, user_message)."""
    system_match = re.search(r"## System\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    system = system_match.group(1).strip() if system_match else ""
    parts = re.split(r"^## System.*?(?=\n## |\Z)", text, maxsplit=1, flags=re.DOTALL)
    user = parts[-1].strip() if len(parts) > 1 else text.strip()
    return system, user


def _parse_topic_list(raw: str) -> list[dict]:
    """Parse the LLM topic list response into a validated list of topic dicts."""
    parsed = extract_json(raw)
    # The top-level result may be a list wrapped in a dict key, or a bare list
    if isinstance(parsed, list):
        topics = parsed
    elif isinstance(parsed, dict):
        # Try common wrapping keys
        for key in ("topics", "topic_list", "outline", "items"):
            if isinstance(parsed.get(key), list):
                topics = parsed[key]
                break
        else:
            topics = []
    else:
        topics = []

    validated = []
    for item in topics:
        if isinstance(item, dict) and "title" in item:
            validated.append({
                "title": str(item["title"]),
                "subtopics": [str(s) for s in item.get("subtopics", [])],
            })
    return validated


async def generate_topics(
    db: AsyncSession, subject: str, script_doc_ids: list[int]
) -> SubjectTopicList:
    """Generate a topic list from script documents for the given subject.

    Calls the LLM using broad RAG context from all script documents.
    Stores the result persistently and returns the record.
    """
    if not script_doc_ids:
        raise ValueError(f"No script documents provided for subject '{subject}'")

    # Retrieve a broad sample of content from all script documents.
    # retrieve_chunks runs sentence-transformer inference synchronously, so
    # offload it to a thread to avoid blocking the async event loop.
    loop = asyncio.get_event_loop()
    chunks = await loop.run_in_executor(
        None,
        partial(
            retrieve_chunks,
            f"Overview of key topics, concepts, and definitions covered in this {subject} course.",
            script_doc_ids,
            None,
            20,
        ),
    )
    context_text = "\n\n---\n\n".join(c.text for c in chunks)

    template_path = _PROMPTS_DIR / "topics" / "generate_topics.md"
    rendered = Template(template_path.read_text()).render(
        subject=subject,
        context_chunks=context_text,
    )

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
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "topic_list",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "topics": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "subtopics": {"type": "array", "items": {"type": "string"}},
                                },
                                "required": ["title", "subtopics"],
                                "additionalProperties": False,
                            },
                        }
                    },
                    "required": ["topics"],
                    "additionalProperties": False,
                },
            },
        },
    )
    await budget_svc.record_usage(model, in_tok, out_tok)

    topics = _parse_topic_list(response_text)
    if not topics:
        logger.warning(
            "Topic generation for '%s' returned empty list. Raw LLM response (first 800 chars): %.800s",
            subject,
            response_text,
        )

    return await TopicRepository(db).upsert(
        subject=subject,
        topics=topics,
        source_doc_ids=script_doc_ids,
    )


async def get_topics(db: AsyncSession, subject: str) -> SubjectTopicList | None:
    """Return the current topic list for a subject, or None if not yet generated."""
    return await TopicRepository(db).get_by_subject(subject)


async def update_topics(
    db: AsyncSession,
    subject: str,
    topics: list[dict],
) -> SubjectTopicList:
    """Manually set the topic list for a subject (overrides any generated list)."""
    # Preserve existing source_doc_ids if available
    repo = TopicRepository(db)
    existing = await repo.get_by_subject(subject)
    source_ids_raw = existing.source_doc_ids if existing else "[]"
    source_doc_ids = json.loads(source_ids_raw)
    return await repo.upsert(subject=subject, topics=topics, source_doc_ids=source_doc_ids)


async def maybe_trigger_generation(
    db: AsyncSession, document_id: int, subject: str
) -> None:
    """Auto-trigger topic generation when a script document is ingested.

    Only runs if no topic list exists yet for this subject.
    Silently skips on any error so ingestion is never blocked.
    """
    try:
        repo = TopicRepository(db)
        existing = await repo.get_by_subject(subject)
        if existing:
            return  # Already have a topic list for this subject

        # Find all ingested script docs for this subject
        doc_repo = DocumentRepository(db)
        all_docs = await doc_repo.list_by_subject(subject)
        script_ids = [d.id for d in all_docs if d.file_type == "script" and d.ingested]
        if not script_ids:
            return

        logger.info(
            "Auto-generating topic list for subject '%s' from docs %s", subject, script_ids
        )
        await generate_topics(db, subject, script_ids)
    except Exception:
        logger.exception("Auto topic generation failed for subject '%s'", subject)
