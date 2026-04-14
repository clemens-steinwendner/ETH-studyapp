"""
Session planning: assign topics, question types, languages, and pre-retrieve RAG context
for each question slot before generation begins (FR-07, FR-08).

The planner is intentionally a pure strategy function:

    plan_session(session, db) -> SessionPlan

Swap the implementation to change allocation strategy (e.g. a MockExamPlanner that
weights topics and question types according to past exam frequency).
"""
from __future__ import annotations

import asyncio
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import partial

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.session import StudySession
from app.db.repositories.document_repo import DocumentRepository
from app.vector_db.retriever import retrieve_chunks


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class QuestionSpec:
    slot: int            # 0-indexed position in the session
    topic: str           # which topic this question covers
    question_type: str   # "coding" | "multiple_choice" | "open_ended"
    language: str | None # "python" | "sql" | "haskell" | None
    context_text: str    # pre-retrieved RAG chunks for this topic (joined with ---)


@dataclass
class SessionPlan:
    specs: list[QuestionSpec]
    by_topic: dict[str, list[QuestionSpec]] = field(default_factory=dict)


# ── Subject → coding language mapping ─────────────────────────────────────────

_SUBJECT_LANGUAGE: dict[str, str] = {
    "databases": "sql",
    "fmfp": "haskell",
}


def _resolve_coding_language(subjects: list[str | None]) -> str:
    """Pick the most suitable coding language given the subjects of selected documents."""
    for subject in subjects:
        if subject and subject.lower() in _SUBJECT_LANGUAGE:
            return _SUBJECT_LANGUAGE[subject.lower()]
    return "python"


# ── Default round-robin planner ────────────────────────────────────────────────

async def plan_session(session: StudySession, db: AsyncSession) -> SessionPlan:
    """
    Build a SessionPlan for the given session using a round-robin strategy.

    Steps:
      a. Resolve topics from session.topic_filter (falls back to ["General"])
      b. Assign topics and question types round-robin across all slots
      c. Determine coding language from document subjects
      d. Retrieve RAG context once per unique topic
      e. Group specs by topic for sequential generation (diversity context)
    """
    # a. Resolve topics
    topics: list[str] = session.topic_filter or ["General"]
    question_types: list[str] = session.question_types or ["multiple_choice"]
    n = session.num_questions

    # b. Assign slots round-robin
    specs: list[QuestionSpec] = [
        QuestionSpec(
            slot=i,
            topic=topics[i % len(topics)],
            question_type=question_types[i % len(question_types)],
            language=None,
            context_text="",
        )
        for i in range(n)
    ]

    # c. Determine coding language from document subjects
    doc_repo = DocumentRepository(db)
    subjects: list[str | None] = []
    for doc_id in session.document_ids:
        doc = await doc_repo.get_by_id(doc_id)
        if doc:
            subjects.append(doc.subject)

    # For multi-subject sessions prefer the most common mapped subject
    mapped = [s for s in subjects if s and s.lower() in _SUBJECT_LANGUAGE]
    if mapped:
        most_common_subject = Counter(mapped).most_common(1)[0][0]
        coding_language = _SUBJECT_LANGUAGE[most_common_subject.lower()]
    else:
        coding_language = "python"

    for spec in specs:
        if spec.question_type == "coding":
            spec.language = coding_language

    # d. Retrieve RAG context once per unique topic (order-preserving dedup)
    unique_topics: list[str] = list(dict.fromkeys(spec.topic for spec in specs))
    loop = asyncio.get_event_loop()
    topic_context: dict[str, str] = {}

    for topic in unique_topics:
        query = (
            f"Course material about: {topic}. "
            f"{session.difficulty.capitalize()} level concepts, definitions, and examples."
        )
        chunks = await loop.run_in_executor(
            None,
            partial(
                retrieve_chunks,
                query,
                session.document_ids,
                session.chapter_ids,
                10,
            ),
        )
        topic_context[topic] = "\n\n---\n\n".join(c.text for c in chunks)

    for spec in specs:
        spec.context_text = topic_context[spec.topic]

    # e. Group by topic (preserving round-robin insertion order per topic)
    by_topic: dict[str, list[QuestionSpec]] = defaultdict(list)
    for spec in specs:
        by_topic[spec.topic].append(spec)

    return SessionPlan(specs=specs, by_topic=dict(by_topic))
