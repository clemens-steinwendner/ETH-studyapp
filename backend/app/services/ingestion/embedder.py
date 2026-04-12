"""
Local embedding computation using sentence-transformers.

Uses a local model to avoid embedding API costs (staying within $8/month budget).
Model: all-MiniLM-L6-v2 (fast, 384-dim, good for semantic search)
"""
from functools import lru_cache

EMBEDDING_MODEL = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_model():  # type: ignore[no-untyped-def]
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return a list of embedding vectors for the given texts."""
    model = _get_model()
    return model.encode(texts, show_progress_bar=False).tolist()
