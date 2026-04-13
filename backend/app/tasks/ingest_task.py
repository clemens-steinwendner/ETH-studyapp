"""
ARQ background task for PDF ingestion (NFR-03: ≤60s for 50-page PDF).

Enqueued by the documents API router after a PDF upload is saved to disk.
"""
from pathlib import Path

from app.db.engine import async_session_factory
from app.services.ingestion.pipeline import run_ingestion


async def ingest_document(ctx: dict, file_path: str, filename: str, document_id: int) -> dict:
    """
    Background worker task: run the full ingestion pipeline for a PDF.

    Args:
        ctx: ARQ context (contains redis connection)
        file_path: Absolute path to the saved PDF file
        filename: Original filename for metadata
        document_id: Pre-created Document.id to update on completion
    """
    async with async_session_factory() as db:
        await run_ingestion(db, Path(file_path), filename, document_id)
    return {"document_id": document_id, "status": "completed"}
