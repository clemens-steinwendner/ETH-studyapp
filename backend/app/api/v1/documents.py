from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.dependencies import DbSession
from app.schemas.document import DocumentOut, DocumentListOut

router = APIRouter()


@router.post("/upload", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(db: DbSession, file: UploadFile = File(...)) -> dict:
    """Accept a PDF upload and enqueue an ingestion job."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    # TODO: save file to UPLOAD_DIR, enqueue ARQ ingest_task, return job_id
    raise NotImplementedError


@router.get("/", response_model=DocumentListOut)
async def list_documents(db: DbSession) -> DocumentListOut:
    """Return all ingested documents with their chapters."""
    # TODO: query document_repo
    raise NotImplementedError


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: DbSession) -> None:
    """Remove a document and its embeddings."""
    # TODO: delete from DB and ChromaDB
    raise NotImplementedError
