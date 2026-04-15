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
from app.db.repositories.exam_profile_repo import ExamProfileRepository
from app.vector_db.retriever import retrieve_chunks


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class QuestionSpec:
    slot: int            # 0-indexed position in the session
    topic: str           # which topic this question covers
    question_type: str   # "coding" | "multiple_choice" | "open_ended" | "true_false" | "multiple_select"
    language: str | None # "python" | "sql" | "haskell" | None
    context_text: str    # pre-retrieved RAG chunks for this topic (joined with ---)


@dataclass
class SessionPlan:
    specs: list[QuestionSpec]
    by_topic: dict[str, list[QuestionSpec]] = field(default_factory=dict)
    style_guidance: str = ""                    # from ExamProfile.style_description
    question_type_weights: dict = field(default_factory=dict)  # from ExamProfile.question_type_distribution


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

    # a2. Look up exam profile for the session's subject to get style guidance
    # and filter question types to those that appear in the exam.
    style_guidance = ""
    question_type_weights: dict = {}
    doc_repo_early = DocumentRepository(db)
    session_subjects: list[str] = []
    for doc_id in session.document_ids:
        doc = await doc_repo_early.get_by_id(doc_id)
        if doc and doc.subject:
            session_subjects.append(doc.subject)

    if session_subjects:
        # Use the most common subject for profile lookup
        from collections import Counter as _Counter
        primary_subject = _Counter(session_subjects).most_common(1)[0][0]
        profile = await ExamProfileRepository(db).get_latest_by_subject(primary_subject)
        if profile:
            style_guidance = profile.style_description
            import json as _json
            question_type_weights = _json.loads(profile.question_type_distribution)
            # Filter question_types to only those present in the exam profile
            if question_type_weights:
                filtered = [qt for qt in question_types if qt in question_type_weights]
                if filtered:
                    question_types = filtered
                # If no overlap (user selected types not in exam), keep original selection

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

    # c. Determine coding language from document subjects (reuse subjects fetched in a2)
    # For multi-subject sessions prefer the most common mapped subject
    mapped = [s for s in session_subjects if s.lower() in _SUBJECT_LANGUAGE]
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
            f"Key concepts, definitions, algorithms, properties, and worked examples "
            f"specifically about: {topic}. Level: {session.difficulty}."
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

    return SessionPlan(
        specs=specs,
        by_topic=dict(by_topic),
        style_guidance=style_guidance,
        question_type_weights=question_type_weights,
    )
