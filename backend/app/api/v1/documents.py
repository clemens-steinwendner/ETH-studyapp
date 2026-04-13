import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.config import settings
from app.db.repositories.document_repo import DocumentRepository
from app.dependencies import ArqPool, DbSession
from app.schemas.document import DocumentListOut
from app.vector_db.client import get_chroma_client
from app.vector_db.collections import DIAGRAM_DESCRIPTIONS, DOCUMENT_CHUNKS

router = APIRouter()

_UPLOAD_DIR = Path(settings.upload_dir)


@router.post("/upload", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    db: DbSession,
    arq_pool: ArqPool,
    file: UploadFile = File(...),
    subject: Annotated[str | None, Form()] = None,
    file_type: Annotated[str, Form()] = "other",
) -> dict:
    """Accept a PDF upload, create a Document record, and enqueue an ingestion job.

    Optional form fields:
    - subject: e.g. "databases", "networks", "ml", "fmfp", "probability"
    - file_type: "script" | "mock_exam" | "other" (default: "other")
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if file_type not in ("script", "mock_exam", "other"):
        file_type = "other"

    # Sanitize filename
    raw_stem = Path(file.filename or "upload").stem
    safe_stem = re.sub(r"[^\w\-]", "_", raw_stem)
    safe_filename = f"{safe_stem}.pdf"

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = _UPLOAD_DIR / safe_filename

    # Avoid overwriting existing files
    counter = 1
    while dest.exists():
        dest = _UPLOAD_DIR / f"{safe_stem}_{counter}.pdf"
        counter += 1

    content = await file.read()
    dest.write_bytes(content)

    # Create Document record with subject and file_type
    repo = DocumentRepository(db)
    doc = await repo.create(
        filename=dest.name,
        subject=subject,
        file_type=file_type,
    )

    # Enqueue background ingestion job (passes subject + file_type for topic auto-trigger)
    await arq_pool.enqueue_job(
        "ingest_document", str(dest), dest.name, doc.id, subject, file_type
    )

    return {"document_id": doc.id, "filename": dest.name}


@router.get("/", response_model=DocumentListOut)
async def list_documents(db: DbSession) -> DocumentListOut:
    """Return all documents with their chapters."""
    repo = DocumentRepository(db)
    docs = await repo.get_all()
    return DocumentListOut(documents=docs)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: DbSession) -> None:
    """Remove a document, its chapters, and all its ChromaDB embeddings."""
    chroma = get_chroma_client()
    for col_name in (DOCUMENT_CHUNKS, DIAGRAM_DESCRIPTIONS):
        col = chroma.get_or_create_collection(col_name)
        col.delete(where={"document_id": document_id})

    await DocumentRepository(db).delete(document_id)
