"""
ARQ background task for PDF ingestion (NFR-03: ≤60s for 50-page PDF).

Enqueued by the documents API router after a PDF upload is saved to disk.
After ingestion completes, auto-triggers topic generation if:
  - the document is a "script" type
  - the document has a subject assigned
  - no topic list exists yet for that subject
"""
from pathlib import Path

from app.db.engine import async_session_factory
from app.services.ingestion.pipeline import run_ingestion


async def ingest_document(
    ctx: dict,
    file_path: str,
    filename: str,
    document_id: int,
    subject: str | None = None,
    file_type: str = "other",
) -> dict:
    """
    Background worker task: run the full ingestion pipeline for a PDF.

    Args:
        ctx: ARQ context (contains redis connection)
        file_path: Absolute path to the saved PDF file
        filename: Original filename for metadata
        document_id: Pre-created Document.id to update on completion
        subject: Subject this document belongs to (optional)
        file_type: "script" | "mock_exam" | "other"
    """
    async with async_session_factory() as db:
        await run_ingestion(db, Path(file_path), filename, document_id)

        # Auto-generate topic list for the subject if this is a script
        if file_type == "script" and subject:
            from app.services.topic_service import maybe_trigger_generation
            await maybe_trigger_generation(db, document_id, subject)

        # Extract exam style profile if this is a mock exam
        if file_type == "mock_exam" and subject:
            from app.services.exam_profile_service import extract_exam_profile
            await extract_exam_profile(db, document_id, subject)

    return {"document_id": document_id, "status": "completed"}
