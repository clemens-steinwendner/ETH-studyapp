"""
Cross-encoder reranking using BAAI/bge-reranker-base.

Reranking re-scores (query, document) pairs with full bidirectional attention,
giving significantly better precision than embedding-based retrieval alone.
Model is lazy-loaded and cached for the process lifetime.
"""
from __future__ import annotations

from functools import lru_cache

RERANKER_MODEL = "BAAI/bge-reranker-base"


@lru_cache(maxsize=1)
def _get_reranker():  # type: ignore[no-untyped-def]
    from sentence_transformers import CrossEncoder
    return CrossEncoder(RERANKER_MODEL)


def rerank(query: str, chunks: list, top_k: int) -> list:
    """Rerank a list of RetrievedChunk objects and return the top_k most relevant.

    Args:
        query: The retrieval query string.
        chunks: List of RetrievedChunk instances (must have a .text attribute).
        top_k: Number of chunks to return after reranking.

    Returns:
        Up to top_k chunks ordered by descending relevance score.
    """
    if not chunks:
        return chunks
    model = _get_reranker()
    pairs = [(query, c.text) for c in chunks]
    scores = model.predict(pairs).tolist()
    ranked = sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)
    return [c for _, c in ranked[:top_k]]
