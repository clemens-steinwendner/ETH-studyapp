"""
Ingestion pipeline orchestrator (FR-01 through FR-06).

Flow:
    PDF file path
    → pdf_parser   : extract text blocks + image blocks
    → latex_cleaner: normalise LaTeX strings in text blocks
    → chunker      : split text into semantic chunks
    → embedder     : compute local embeddings for each chunk
    → diagram_describer (async, per image): Vision LLM → caption text
    → store chunks + captions in ChromaDB
    → store document metadata + chapters in SQLite
"""
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession


async def run_ingestion(db: AsyncSession, file_path: Path, filename: str) -> int:
    """
    Run the full ingestion pipeline for a PDF.

    Returns the document_id of the newly created Document record.
    """
    # TODO: implement full pipeline
    raise NotImplementedError
