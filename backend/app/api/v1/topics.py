"""
Topics API — manage persistent topic lists per subject.

GET  /api/v1/topics/{subject}           — return current topic list (404 if none)
POST /api/v1/topics/{subject}/generate  — (re)generate from script documents
PUT  /api/v1/topics/{subject}           — manual update / override
"""
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.dependencies import DbSession, BudgetGuard
from app.services import topic_service

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TopicItem(BaseModel):
    title: str
    subtopics: list[str]


class TopicListOut(BaseModel):
    subject: str
    topics: list[TopicItem]
    generated_at: str
    source_doc_ids: list[int]


class TopicListUpdateIn(BaseModel):
    topics: list[TopicItem]


# ── Helper ────────────────────────────────────────────────────────────────────

def _to_out(record) -> TopicListOut:  # type: ignore[no-untyped-def]
    topics_raw = json.loads(record.topics_json)
    source_ids = json.loads(record.source_doc_ids)
    return TopicListOut(
        subject=record.subject,
        topics=[TopicItem(**t) for t in topics_raw],
        generated_at=record.generated_at.isoformat(),
        source_doc_ids=source_ids,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/subjects", response_model=list[str], tags=["topics"])
async def list_subjects() -> list[str]:
    """Return the configured list of subjects."""
    return settings.subjects


@router.get("/{subject}", response_model=TopicListOut)
async def get_topic_list(subject: str, db: DbSession) -> TopicListOut:
    record = await topic_service.get_topics(db, subject)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No topic list found for subject '{subject}'. "
                   "Upload a script document and it will be generated automatically, "
                   "or POST to /generate.",
        )
    return _to_out(record)


@router.post("/{subject}/generate", response_model=TopicListOut)
async def generate_topic_list(
    subject: str,
    db: DbSession,
    _: BudgetGuard,
) -> TopicListOut:
    """(Re)generate the topic list for a subject from its script documents."""
    from app.db.repositories.document_repo import DocumentRepository

    doc_repo = DocumentRepository(db)
    all_docs = await doc_repo.list_by_subject(subject)
    script_ids = [d.id for d in all_docs if d.file_type == "script" and d.ingested]

    if not script_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No ingested script documents found for subject '{subject}'. "
                   "Upload at least one file with file_type='script' first.",
        )

    record = await topic_service.generate_topics(db, subject, script_ids)
    return _to_out(record)


@router.put("/{subject}", response_model=TopicListOut)
async def update_topic_list(
    subject: str,
    body: TopicListUpdateIn,
    db: DbSession,
) -> TopicListOut:
    """Manually set or override the topic list for a subject."""
    topics_dicts = [t.model_dump() for t in body.topics]
    record = await topic_service.update_topics(db, subject, topics_dicts)
    return _to_out(record)
