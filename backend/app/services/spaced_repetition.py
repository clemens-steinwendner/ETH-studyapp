"""
Spaced repetition: generate a retry session from previously failed exercises (FR-22).
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.db.models.session import StudySession
from app.db.repositories.exercise_repo import ExerciseRepository
from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import SessionOut


async def create_retry_session(db: AsyncSession, source_session_ids: list[int] | None = None) -> SessionOut:
    """
    Create a new session populated exclusively with exercises marked as Failed.

    If source_session_ids is provided, only failed exercises from those sessions
    are included. Otherwise all historical failures are eligible.
    """
    failed_exercises = await ExerciseRepository(db).get_failed_exercises(source_session_ids)
    if not failed_exercises:
        raise HTTPException(status_code=422, detail="No failed exercises found")

    # Collect document_ids from source sessions
    session_ids_from_exercises = list({ex.session_id for ex in failed_exercises})
    ids_to_query = source_session_ids if source_session_ids else session_ids_from_exercises

    source_sessions_result = await db.execute(
        select(StudySession)
        .where(StudySession.id.in_(ids_to_query))
        .order_by(StudySession.created_at.desc())
    )
    source_sessions = list(source_sessions_result.scalars().all())

    # Deduplicate document_ids across all source sessions
    document_ids: list[int] = []
    seen: set[int] = set()
    for s in source_sessions:
        for doc_id in (s.document_ids or []):
            if doc_id not in seen:
                seen.add(doc_id)
                document_ids.append(doc_id)

    # Derive difficulty and question_types from the most recent source session
    if source_sessions:
        most_recent = source_sessions[0]  # already ordered by created_at desc
        difficulty: str = most_recent.difficulty
        question_types: list[str] = most_recent.question_types
    else:
        difficulty = "application"
        question_types = ["coding", "multiple_choice", "open_ended"]

    new_session = await SessionRepository(db).create(
        document_ids=document_ids,
        chapter_ids=None,
        difficulty=difficulty,
        question_types=question_types,
        num_questions=min(len(failed_exercises), 50),
        hints_enabled=True,
        is_retry_session=True,
        topic_filter=None,
    )

    # Copy failed exercises into the new session so the session page replays
    # the exact same questions instead of generating new ones via LLM.
    ex_repo = ExerciseRepository(db)
    for ex in failed_exercises:
        await ex_repo.create(
            session_id=new_session.id,
            question_type=ex.question_type,
            language=ex.language,
            question_text=ex.question_text,
            test_cases=ex.test_cases,
        )

    return SessionOut.model_validate(new_session)
