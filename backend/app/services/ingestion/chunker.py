"""
Sliding-window semantic chunking for RAG.

Splits text blocks into overlapping chunks suitable for embedding.
Respects paragraph and LaTeX math boundaries to avoid splitting formulas.
"""
from dataclasses import dataclass

CHUNK_SIZE = 400    # tokens (approximate)
CHUNK_OVERLAP = 80  # tokens


@dataclass
class Chunk:
    text: str
    page: int
    chunk_index: int
    document_id: int


def chunk_text_blocks(text_blocks: list, document_id: int) -> list[Chunk]:
    """Produce overlapping chunks from a list of TextBlock objects."""
    # TODO: implement sliding window with paragraph boundary awareness
    raise NotImplementedError
