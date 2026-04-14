"""
Re-indexing script: wipe ChromaDB and re-queue all documents for ingestion.

Run this after changing the embedding model (dimensions changed from 384→768)
or any other modification that invalidates existing embeddings.

Usage (from the backend/ directory):
    python scripts/reindex.py
"""
import asyncio
import shutil
import sys
from pathlib import Path

# Ensure the app package is importable when run from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.db.engine import async_session_factory
from app.db.repositories.document_repo import DocumentRepository


async def main() -> None:
    # ── 1. Wipe ChromaDB ─────────────────────────────────────────────────────
    chroma_dir = Path(settings.chroma_persist_dir)
    if chroma_dir.exists():
        shutil.rmtree(chroma_dir)
        print(f"Deleted ChromaDB data at {chroma_dir}")
    else:
        print(f"ChromaDB directory not found at {chroma_dir}, skipping deletion.")

    # ── 2. Mark all documents as un-ingested and re-queue ────────────────────
    from arq import create_pool
    from arq.connections import RedisSettings

    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    pool = await create_pool(redis_settings)

    async with async_session_factory() as db:
        repo = DocumentRepository(db)
        docs = await repo.get_all()

        if not docs:
            print("No documents found in the database.")
            await pool.close()
            return

        queued = 0
        for doc in docs:
            upload_path = Path(settings.upload_dir) / doc.filename
            if not upload_path.exists():
                print(f"  SKIP (file missing): {doc.filename}")
                continue

            await repo.mark_unindexed(doc.id)
            await pool.enqueue_job(
                "ingest_document",
                str(upload_path),
                doc.filename,
                doc.id,
                doc.subject,
                doc.file_type,
            )
            print(f"  Queued: {doc.filename} (id={doc.id})")
            queued += 1

    await pool.close()
    print(f"\nDone. {queued} document(s) queued for re-ingestion.")
    print("Make sure the ARQ worker is running: make worker")


if __name__ == "__main__":
    asyncio.run(main())
