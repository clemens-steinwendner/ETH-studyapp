"""
Ingestion pipeline orchestrator (FR-01 through FR-06).

Flow:
    PDF file path
    → pdf_parser         : extract text blocks + image blocks
    → latex_cleaner      : normalise LaTeX strings in text blocks
    → chapter extraction : extract chapter structure from TOC/headings,
                           create Chapter records in SQLite (with IDs),
                           build page → (chapter_id, chapter_title) lookup
    → chunker            : split text into semantic chunks
    → embedder           : compute local embeddings with contextual chapter prefix
    → store chunks       : ChromaDB with chapter_id + chapter_title metadata
    → diagram_describer  : Vision LLM → caption text, embed, store
    → mark ingested
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


def _extract_chapter_structure(
    file_path: Path,
    cleaned_blocks: list,
    total_pages: int,
) -> list[tuple[str, int, int]]:
    """Return a list of (title, page_start_0indexed, page_end_0indexed) tuples.

    Uses PDF bookmarks (TOC) as the primary source; falls back to numbered
    heading detection in the text blocks.
    """
    last_page = max((b.page for b in cleaned_blocks), default=0)

    fitz_doc = fitz.open(str(file_path))
    toc = fitz_doc.get_toc()  # list of [level, title, page_1indexed]
    fitz_doc.close()

    chapters: list[tuple[str, int, int]] = []

    if toc:
        top_level = [(title, page) for level, title, page in toc if level == 1]
        for idx, (title, page_1) in enumerate(top_level):
            page_start = max(0, page_1 - 1)
            page_end = (
                min(top_level[idx + 1][1] - 2, total_pages - 1)
                if idx + 1 < len(top_level)
                else min(last_page, total_pages - 1)
            )
            chapters.append((title, page_start, page_end))
    else:
        detected: list[tuple[str, int]] = []
        seen: set[str] = set()
        for block in cleaned_blocks:
            candidate = " ".join(block.text.split()[:10]).strip()
            if _SECTION_PATTERN.match(candidate) and candidate not in seen:
                detected.append((candidate, block.page))
                seen.add(candidate)
        for idx, (title, page_start) in enumerate(detected):
            page_end = detected[idx + 1][1] - 1 if idx + 1 < len(detected) else last_page
            chapters.append((title, page_start, max(page_start, page_end)))

    return chapters


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

    # ── 3. Extract chapter structure + create SQLite records ─────────────────
    fitz_doc = fitz.open(str(file_path))
    total_pages = len(fitz_doc)
    fitz_doc.close()

    chapter_specs = _extract_chapter_structure(file_path, cleaned_blocks, total_pages)

    # Create Chapter rows and build page → (chapter_id, title) mapping
    page_to_chapter: dict[int, tuple[int, str]] = {}
    for title, page_start, page_end in chapter_specs:
        chapter = await doc_repo.add_chapter(
            document_id=document_id,
            title=title,
            page_start=page_start,
            page_end=page_end,
        )
        for p in range(page_start, page_end + 1):
            page_to_chapter[p] = (chapter.id, chapter.title)

    # ── 4. Chunk text ─────────────────────────────────────────────────────────
    chunks = chunk_text_blocks(cleaned_blocks, document_id)

    # ── 5. Embed + store text chunks ──────────────────────────────────────────
    if chunks:
        # Contextual prefix: embed "[Chapter: <title>]\n<text>" but store raw text.
        # This anchors each chunk's vector to its chapter topic without inflating
        # the stored document shown to the LLM.
        embed_inputs: list[str] = []
        for c in chunks:
            chapter_info = page_to_chapter.get(c.page)
            if chapter_info:
                embed_inputs.append(f"[Chapter: {chapter_info[1]}]\n{c.text}")
            else:
                embed_inputs.append(c.text)

        embeddings = embed_texts(embed_inputs)

        chunks_col.add(
            ids=[f"doc{document_id}_chunk{c.chunk_index}" for c in chunks],
            embeddings=embeddings,
            documents=[c.text for c in chunks],  # store original text
            metadatas=[
                {
                    "document_id": document_id,
                    "page": c.page,
                    "chunk_index": c.chunk_index,
                    "chapter_id": page_to_chapter.get(c.page, (0, ""))[0],
                    "chapter_title": page_to_chapter.get(c.page, (0, ""))[1],
                }
                for c in chunks
            ],
        )

    # ── 6. Vision-caption images, embed, store ────────────────────────────────
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
            chapter_info = page_to_chapter.get(img_block.page)
            diagrams_col.add(
                ids=[f"doc{document_id}_img{i}"],
                embeddings=[desc_embedding],
                documents=[description],
                metadatas=[{
                    "document_id": document_id,
                    "page": img_block.page,
                    "chapter_id": chapter_info[0] if chapter_info else 0,
                    "chapter_title": chapter_info[1] if chapter_info else "",
                }],
            )

    # ── 7. Mark document as ingested ─────────────────────────────────────────
    await doc_repo.mark_ingested(document_id)
