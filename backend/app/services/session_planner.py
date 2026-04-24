"""
Session planning: assign topics, question types, languages, and pre-retrieve RAG context
for each question slot before generation begins (FR-07, FR-08).

Plan output drives:
  - which exercises get generated
  - what RAG chunks are used (and stored as source citations on each exercise)
  - exam-profile-derived weighting of topics, common-trap probing, style guidance
  - cross-topic synthesis questions when synthesis_enabled and difficulty=synthesis
"""
from __future__ import annotations

import asyncio
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import partial

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.session import StudySession
from app.db.repositories.document_repo import DocumentRepository
from app.db.repositories.exam_profile_repo import ExamProfileRepository
from app.vector_db.retriever import RetrievedChunk, retrieve_chunks


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class QuestionSpec:
    slot: int
    topic: str                                  # primary topic ("A" or "A + B" for synthesis)
    secondary_topic: str | None                 # only set for synthesis questions
    question_type: str
    language: str | None
    context_text: str
    sources: list[dict] = field(default_factory=list)  # [{document_id, chapter_id, page}]
    is_synthesis: bool = False


@dataclass
class CoveragePreview:
    """Lightweight summary returned by the /preview endpoint (no LLM calls)."""
    topic_counts: dict[str, int]
    question_type_counts: dict[str, int]
    synthesis_count: int
    exam_profile_used: bool
    weighting_source: str  # "round-robin" | "exam-profile"


@dataclass
class SessionPlan:
    specs: list[QuestionSpec]
    by_topic: dict[str, list[QuestionSpec]] = field(default_factory=dict)
    style_guidance: str = ""
    question_type_weights: dict = field(default_factory=dict)
    common_traps: list[str] = field(default_factory=list)
    coverage: CoveragePreview | None = None


# ── Subject → coding language mapping ─────────────────────────────────────────

_SUBJECT_LANGUAGE: dict[str, str] = {
    "databases": "sql",
    "fmfp": "haskell",
}


def _resolve_coding_language(subjects: list[str | None]) -> str:
    for subject in subjects:
        if subject and subject.lower() in _SUBJECT_LANGUAGE:
            return _SUBJECT_LANGUAGE[subject.lower()]
    return "python"


# ── Topic weighting ────────────────────────────────────────────────────────────

def _weighted_topic_allocation(
    topics: list[str],
    n: int,
    topic_frequency: dict[str, float] | None,
) -> list[str]:
    """Allocate n slots across topics, weighted by topic_frequency when available.

    Matches by case-insensitive substring containment between session topic strings
    and exam-profile keys (kebab-case). Topics with no exam-profile match get a
    uniform fallback weight equal to the smallest non-zero matched weight.
    """
    if not topics:
        return ["General"] * n

    if topic_frequency:
        normalized = {k.lower(): v for k, v in topic_frequency.items() if v > 0}
        weights: list[float] = []
        for t in topics:
            tl = t.lower()
            match = next(
                (v for k, v in normalized.items() if k in tl or tl.replace(" ", "-") == k),
                None,
            )
            weights.append(match if match is not None else 0.0)
        # Topics with no match get the average of matched weights (or 1 if none matched)
        matched = [w for w in weights if w > 0]
        fallback = (sum(matched) / len(matched)) if matched else 1.0
        weights = [w if w > 0 else fallback for w in weights]
        total = sum(weights)
        # Largest-remainder allocation so the slot count exactly equals n
        raw = [(w / total) * n for w in weights]
        floors = [math.floor(x) for x in raw]
        remaining = n - sum(floors)
        # Distribute remaining slots to topics with the largest fractional remainders
        order = sorted(range(len(topics)), key=lambda i: raw[i] - floors[i], reverse=True)
        for i in order[:remaining]:
            floors[i] += 1
        # Build slot list interleaved (so the user doesn't see all of one topic in a row)
        per_topic = list(zip(topics, floors))
        ordered: list[str] = []
        # Round-robin over topics with remaining counts
        while any(c > 0 for _, c in per_topic):
            for i, (t, c) in enumerate(per_topic):
                if c > 0:
                    ordered.append(t)
                    per_topic[i] = (t, c - 1)
        return ordered

    # No exam profile → round-robin
    return [topics[i % len(topics)] for i in range(n)]


# ── Synthesis pair selection ───────────────────────────────────────────────────

def _select_synthesis_pairs(topics: list[str], k: int) -> list[tuple[str, str]]:
    """Pick k pairs of distinct topics, round-robin so we don't always pair the same two."""
    if len(topics) < 2 or k <= 0:
        return []
    pairs: list[tuple[str, str]] = []
    n = len(topics)
    i = 0
    j = 1
    while len(pairs) < k:
        pairs.append((topics[i % n], topics[j % n]))
        i += 1
        j = (j + 1) if (j + 1) % n != i % n else (j + 2)
        if j % n == i % n:
            j = (i + 1) % n
    return pairs


# ── Public planner ─────────────────────────────────────────────────────────────

async def plan_session(session: StudySession, db: AsyncSession) -> SessionPlan:
    """Build a SessionPlan, optionally weighted by past-exam topic frequency.

    Steps:
      a. Resolve topics, question types, RAG-eligible documents, primary subject
      b. Look up ExamProfile → style_guidance, type_weights, topic_frequency, common_traps
      c. Allocate single-topic slots across topics (weighted or round-robin)
      d. Replace ~30% of slots with synthesis pairs when enabled
      e. Round-robin question types across slots; coding language per subject
      f. Pre-retrieve RAG chunks once per (topic | pair); capture top-3 as source citations
    """
    topics: list[str] = session.topic_filter or ["General"]
    question_types: list[str] = session.question_types or ["multiple_choice"]
    n = session.num_questions

    # a. Document/subject resolution + filter mock_exam docs out of the RAG pool
    doc_repo = DocumentRepository(db)
    rag_document_ids: list[int] = []
    session_subjects: list[str] = []
    for doc_id in session.document_ids:
        doc = await doc_repo.get_by_id(doc_id)
        if doc:
            if doc.file_type != "mock_exam":
                rag_document_ids.append(doc_id)
            if doc.subject:
                session_subjects.append(doc.subject)

    # b. Exam profile lookup
    style_guidance = ""
    question_type_weights: dict = {}
    topic_frequency: dict[str, float] = {}
    common_traps: list[str] = []
    if session_subjects:
        primary_subject = Counter(session_subjects).most_common(1)[0][0]
        profile = await ExamProfileRepository(db).get_latest_by_subject(primary_subject)
        if profile:
            style_guidance = profile.style_description
            try:
                question_type_weights = json.loads(profile.question_type_distribution)
            except (TypeError, ValueError):
                question_type_weights = {}
            try:
                topic_frequency = json.loads(profile.topic_frequency) if profile.topic_frequency else {}
            except (TypeError, ValueError):
                topic_frequency = {}
            try:
                common_traps = json.loads(profile.common_traps) if profile.common_traps else []
            except (TypeError, ValueError):
                common_traps = []
            if question_type_weights:
                filtered = [qt for qt in question_types if qt in question_type_weights]
                if filtered:
                    question_types = filtered

    # c. Slot allocation
    slot_topics = _weighted_topic_allocation(topics, n, topic_frequency)

    # d. Synthesis substitution
    do_synthesis = (
        bool(session.synthesis_enabled)
        and session.difficulty == "synthesis"
        and len(topics) >= 2
        and not session.exam_mode  # exam mode keeps the predictable distribution
    )
    synthesis_count = max(1, round(0.3 * n)) if do_synthesis else 0
    synthesis_pairs: list[tuple[str, str]] = _select_synthesis_pairs(topics, synthesis_count)

    # e. Build specs
    coding_language = _resolve_coding_language(session_subjects)
    specs: list[QuestionSpec] = []
    for i in range(n):
        if i < len(synthesis_pairs):
            t1, t2 = synthesis_pairs[i]
            qtype = question_types[i % len(question_types)]
            specs.append(QuestionSpec(
                slot=i,
                topic=f"{t1} + {t2}",
                secondary_topic=t2,
                question_type=qtype,
                language=coding_language if qtype == "coding" else None,
                context_text="",
                is_synthesis=True,
            ))
        else:
            primary = slot_topics[i] if i < len(slot_topics) else topics[i % len(topics)]
            qtype = question_types[i % len(question_types)]
            specs.append(QuestionSpec(
                slot=i,
                topic=primary,
                secondary_topic=None,
                question_type=qtype,
                language=coding_language if qtype == "coding" else None,
                context_text="",
                is_synthesis=False,
            ))

    # Override the topic for the FIRST synthesis spec to use the original topic
    # name as the dict key — already handled via "{t1} + {t2}" naming.

    # f. RAG retrieval, dedup'd by topic key
    loop = asyncio.get_event_loop()
    topic_context: dict[str, tuple[str, list[dict]]] = {}

    async def fetch_topic(query: str) -> list[RetrievedChunk]:
        return await loop.run_in_executor(
            None,
            partial(retrieve_chunks, query, rag_document_ids, session.chapter_ids, 10),
        )

    for spec in specs:
        if spec.topic in topic_context:
            continue
        if spec.is_synthesis:
            t1 = spec.topic.split(" + ", 1)[0]
            t2 = spec.secondary_topic or t1
            q1 = f"Key concepts and worked examples about: {t1}. Level: {session.difficulty}."
            q2 = f"Key concepts and worked examples about: {t2}. Level: {session.difficulty}."
            chunks_a = await fetch_topic(q1)
            chunks_b = await fetch_topic(q2)
            # Interleave to keep both topics represented in context
            interleaved: list[RetrievedChunk] = []
            for a, b in zip(chunks_a, chunks_b):
                interleaved.extend([a, b])
            interleaved.extend(chunks_a[len(chunks_b):])
            interleaved.extend(chunks_b[len(chunks_a):])
            chunks = interleaved[:12]
        else:
            chunks = await fetch_topic(
                f"Key concepts, definitions, algorithms, properties, and worked examples "
                f"specifically about: {spec.topic}. Level: {session.difficulty}."
            )
        context_text = "\n\n---\n\n".join(c.text for c in chunks)
        sources = _dedup_sources([
            {"document_id": c.document_id, "chapter_id": c.chapter_id, "page": c.page}
            for c in chunks[:6]
        ])
        topic_context[spec.topic] = (context_text, sources)

    for spec in specs:
        ctx, srcs = topic_context[spec.topic]
        spec.context_text = ctx
        spec.sources = srcs

    # by_topic grouping (preserves slot order within topic)
    by_topic: dict[str, list[QuestionSpec]] = defaultdict(list)
    for spec in specs:
        by_topic[spec.topic].append(spec)

    # Coverage preview
    coverage = CoveragePreview(
        topic_counts={t: len(v) for t, v in by_topic.items()},
        question_type_counts=dict(Counter(s.question_type for s in specs)),
        synthesis_count=sum(1 for s in specs if s.is_synthesis),
        exam_profile_used=bool(topic_frequency or question_type_weights),
        weighting_source="exam-profile" if topic_frequency else "round-robin",
    )

    return SessionPlan(
        specs=specs,
        by_topic=dict(by_topic),
        style_guidance=style_guidance,
        question_type_weights=question_type_weights,
        common_traps=common_traps,
        coverage=coverage,
    )


def _dedup_sources(sources: list[dict]) -> list[dict]:
    """Deduplicate citation rows by (document_id, page), preserving first-seen order."""
    seen: set[tuple[int, int]] = set()
    out: list[dict] = []
    for s in sources:
        key = (s["document_id"], s["page"])
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out
