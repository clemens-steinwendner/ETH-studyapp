"""
Cross-encoder reranking using BAAI/bge-reranker-base.

Reranking re-scores (query, document) pairs with full bidirectional attention,
giving significantly better precision than embedding-based retrieval alone.
Model is lazy-loaded and cached for the process lifetime.

Scores are sigmoid-normalized to [0, 1] and written back to each chunk so
callers can apply relevance thresholds.
"""
from __future__ import annotations

import math
from functools import lru_cache

RERANKER_MODEL = "BAAI/bge-reranker-base"


@lru_cache(maxsize=1)
def _get_reranker():  # type: ignore[no-untyped-def]
    from sentence_transformers import CrossEncoder
    return CrossEncoder(RERANKER_MODEL)


def rerank(query: str, chunks: list, top_k: int) -> list:
    """Rerank a list of RetrievedChunk objects and return the top_k most relevant.

    Scores are sigmoid-normalized to (0, 1) and written back to each chunk's
    .score attribute so callers can filter by relevance threshold.

    Args:
        query: The retrieval query string.
        chunks: List of RetrievedChunk instances (must have .text and .score).
        top_k: Number of chunks to return after reranking.

    Returns:
        Up to top_k chunks ordered by descending relevance score.
    """
    if not chunks:
        return chunks
    model = _get_reranker()
    pairs = [(query, c.text) for c in chunks]
    raw_scores = model.predict(pairs).tolist()
    # Sigmoid-normalize: converts raw logits to (0,1); >0.5 = cross-encoder thinks relevant
    scored = [(1.0 / (1.0 + math.exp(-s)), c) for s, c in zip(raw_scores, chunks)]
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]
    for norm_score, chunk in top:
        chunk.score = norm_score  # write normalized score back so callers can threshold
    return [c for _, c in top]
