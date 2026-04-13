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
from __future__ import annotations

import re
from dataclasses import replace
from pathlib import Path

import fitz  # PyMuPDF — used to read TOC for chapter extraction
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.repositories.document_repo import DocumentRepository
from app.services.budget_service import BudgetService
from app.services.ingestion.pdf_parser import parse_pdf
from app.services.ingestion.latex_cleaner import preserve_latex
from app.services.ingestion.chunker import chunk_text_blocks
from app.services.ingestion.embedder import embed_texts
from app.services.ingestion.diagram_describer import describe_diagram
from app.vector_db.client import get_chroma_client
from app.vector_db.collections import DOCUMENT_CHUNKS, DIAGRAM_DESCRIPTIONS

_SECTION_PATTERN = re.compile(r"^\d+\.?\s+\w")


async def run_ingestion(
    db: AsyncSession,
    file_path: Path,
    filename: str,
    document_id: int,
) -> None:
    """
    Run the full ingestion pipeline for an already-created Document record.

    The caller (API route + ARQ task) creates the Document row first to obtain
    the ID, then passes it here. This function populates ChromaDB and SQLite,
    and finally sets Document.ingested = True.
    """
    doc_repo = DocumentRepository(db)
    budget_svc = BudgetService(db)
    chroma = get_chroma_client()
    chunks_col = chroma.get_or_create_collection(DOCUMENT_CHUNKS)
    diagrams_col = chroma.get_or_create_collection(DIAGRAM_DESCRIPTIONS)

    # ── 1. Parse PDF ──────────────────────────────────────────────────────────
    text_blocks, image_blocks = parse_pdf(file_path)

    # ── 2. Clean LaTeX (immutable — create new dataclass instances) ───────────
    cleaned_blocks = [replace(b, text=preserve_latex(b.text)) for b in text_blocks]

    # ── 3. Chunk text ─────────────────────────────────────────────────────────
    chunks = chunk_text_blocks(cleaned_blocks, document_id)

    # ── 4. Embed + store text chunks ──────────────────────────────────────────
    if chunks:
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)
        chunks_col.add(
            ids=[f"doc{document_id}_chunk{c.chunk_index}" for c in chunks],
            embeddings=embeddings,
            documents=texts,
            metadatas=[
                {
                    "document_id": document_id,
                    "page": c.page,
                    "chunk_index": c.chunk_index,
                }
                for c in chunks
            ],
        )

    # ── 5. Vision-caption images, embed, store ────────────────────────────────
    # Serial (not gather) — ensures each call is budgeted before the next begins
    for i, img_block in enumerate(image_blocks):
        description, in_tok, out_tok = await describe_diagram(
            img_block.image_bytes, img_block.page
        )
        await budget_svc.record_usage(
            model=settings.fireworks_vision_model,
            input_tokens=in_tok,
            output_tokens=out_tok,
        )
        if description:
            desc_embedding = embed_texts([description])[0]
            diagrams_col.add(
                ids=[f"doc{document_id}_img{i}"],
                embeddings=[desc_embedding],
                documents=[description],
                metadatas=[{"document_id": document_id, "page": img_block.page}],
            )

    # ── 6. Extract chapters ───────────────────────────────────────────────────
    fitz_doc = fitz.open(str(file_path))
    toc = fitz_doc.get_toc()  # list of [level, title, page_1indexed]
    total_pages = len(fitz_doc)
    fitz_doc.close()

    last_page = max((b.page for b in cleaned_blocks), default=0)

    if toc:
        # Use PDF bookmarks — most reliable source of chapter structure
        top_level = [(title, page) for level, title, page in toc if level == 1]
        for idx, (title, page_1) in enumerate(top_level):
            page_start = page_1 - 1  # normalise to 0-indexed
            if idx + 1 < len(top_level):
                page_end = top_level[idx + 1][1] - 2  # exclusive end, 0-indexed
            else:
                page_end = last_page
            await doc_repo.add_chapter(
                document_id=document_id,
                title=title,
                page_start=max(0, page_start),
                page_end=min(page_end, total_pages - 1),
            )
    else:
        # Fallback: scan text blocks for numbered section headings
        detected: list[tuple[str, int]] = []
        seen: set[str] = set()
        for block in cleaned_blocks:
            first_line = block.text.split(" ")[0:10]  # rough first line
            candidate = " ".join(first_line).strip()
            if _SECTION_PATTERN.match(candidate) and candidate not in seen:
                detected.append((candidate, block.page))
                seen.add(candidate)

        for idx, (title, page_start) in enumerate(detected):
            page_end = detected[idx + 1][1] - 1 if idx + 1 < len(detected) else last_page
            await doc_repo.add_chapter(
                document_id=document_id,
                title=title,
                page_start=page_start,
                page_end=max(page_start, page_end),
            )

    # ── 7. Mark document as ingested ─────────────────────────────────────────
    await doc_repo.mark_ingested(document_id)
