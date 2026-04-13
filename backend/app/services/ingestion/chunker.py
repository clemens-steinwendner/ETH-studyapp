"""
Sliding-window semantic chunking for RAG.

Splits text blocks into overlapping chunks suitable for embedding.
Respects paragraph and LaTeX math boundaries to avoid splitting formulas.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.ingestion.latex_cleaner import INLINE_MATH, DISPLAY_MATH

CHUNK_SIZE = 400    # tokens (approximate)
CHUNK_OVERLAP = 80  # tokens

CHARS_PER_TOKEN = 4
MAX_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN        # 1600
OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN  # 320


@dataclass
class Chunk:
    text: str
    page: int
    chunk_index: int
    document_id: int


def _split_into_paragraphs(block: object) -> list[tuple[int, str]]:
    """Return (page, paragraph_text) pairs for one TextBlock."""
    parts = re.split(r"\n{2,}", block.text)  # type: ignore[attr-defined]
    return [(block.page, p.strip()) for p in parts if p.strip()]  # type: ignore[attr-defined]


def _inside_math(text: str, pos: int) -> bool:
    """Return True if character position pos falls inside a LaTeX math region."""
    for pattern in (DISPLAY_MATH, INLINE_MATH):
        for m in pattern.finditer(text):
            if m.start() < pos < m.end():
                return True
    return False


def chunk_text_blocks(text_blocks: list, document_id: int) -> list[Chunk]:
    """Produce overlapping chunks from a list of TextBlock objects."""
    # Flatten all blocks → (page, paragraph) pairs
    paragraphs: list[tuple[int, str]] = []
    for block in text_blocks:
        paragraphs.extend(_split_into_paragraphs(block))

    if not paragraphs:
        return []

    chunks: list[Chunk] = []
    chunk_index = 0

    buf_text = ""
    buf_page = paragraphs[0][0]
    buf_paras: list[tuple[int, str]] = []

    def flush() -> None:
        nonlocal buf_text, buf_page, buf_paras, chunk_index
        if not buf_text:
            return
        chunks.append(Chunk(
            text=buf_text,
            page=buf_page,
            chunk_index=chunk_index,
            document_id=document_id,
        ))
        chunk_index += 1

        # Build overlap: carry back trailing paragraphs up to OVERLAP_CHARS
        overlap_buf = ""
        overlap_paras: list[tuple[int, str]] = []
        for p_page, p_para in reversed(buf_paras):
            candidate = (p_para + "\n\n" + overlap_buf).strip() if overlap_buf else p_para
            if len(candidate) <= OVERLAP_CHARS:
                overlap_buf = candidate
                overlap_paras.insert(0, (p_page, p_para))
            else:
                break

        buf_text = overlap_buf
        buf_page = overlap_paras[0][0] if overlap_paras else buf_page
        buf_paras = overlap_paras

    for page, para in paragraphs:
        candidate = (buf_text + "\n\n" + para).strip() if buf_text else para

        if len(candidate) <= MAX_CHARS:
            # Paragraph fits — accumulate
            buf_text = candidate
            buf_paras.append((page, para))
            if not buf_paras or (len(buf_paras) == 1 and not buf_text):
                buf_page = page
        elif not buf_text:
            # Single paragraph exceeds MAX_CHARS — hard-split at safe boundary
            _emit_large_paragraph(para, page, chunks, chunk_index, document_id)
            chunk_index += len([c for c in chunks]) - chunk_index
            # Reset buffer (no overlap from oversized para)
        else:
            # Current paragraph would overflow — flush first, then start fresh
            flush()
            candidate_after_overlap = (buf_text + "\n\n" + para).strip() if buf_text else para
            if len(candidate_after_overlap) <= MAX_CHARS:
                buf_text = candidate_after_overlap
                buf_paras.append((page, para))
            else:
                # Even after overlap the para is too big — emit it standalone
                flush()
                _emit_large_paragraph(para, page, chunks, chunk_index, document_id)
                chunk_index = len(chunks)
                buf_text = ""
                buf_page = page
                buf_paras = []

    flush()
    return chunks


def _emit_large_paragraph(
    para: str,
    page: int,
    chunks: list[Chunk],
    chunk_index: int,
    document_id: int,
) -> None:
    """Hard-split a paragraph that exceeds MAX_CHARS, respecting math boundaries."""
    remaining = para
    local_index = chunk_index
    while len(remaining) > MAX_CHARS:
        split_at = MAX_CHARS
        # Walk backwards to find a split point not inside a math region
        while split_at > MAX_CHARS // 2 and _inside_math(remaining, split_at):
            split_at -= 1
        if split_at <= MAX_CHARS // 2:
            # No safe split found — emit whole remaining text as one chunk
            split_at = len(remaining)

        chunks.append(Chunk(
            text=remaining[:split_at].strip(),
            page=page,
            chunk_index=local_index,
            document_id=document_id,
        ))
        local_index += 1
        remaining = remaining[split_at:].strip()

    if remaining:
        chunks.append(Chunk(
            text=remaining,
            page=page,
            chunk_index=local_index,
            document_id=document_id,
        ))
