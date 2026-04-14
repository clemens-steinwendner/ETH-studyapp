"""
Local embedding computation using sentence-transformers.

Uses a local model to avoid embedding API costs (staying within $8/month budget).
Model: BAAI/bge-large-en-v1.5 (768-dim, strong academic-text retrieval quality)

BGE models require a query instruction prefix at retrieval time but NOT at
indexing time — use embed_query() for search queries, embed_texts() for passages.
"""
from functools import lru_cache

EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"
_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


@lru_cache(maxsize=1)
def _get_model():  # type: ignore[no-untyped-def]
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed document passages for indexing (no instruction prefix)."""
    model = _get_model()
    return model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()


def embed_query(text: str) -> list[float]:
    """Embed a retrieval query with the BGE instruction prefix."""
    model = _get_model()
    return model.encode(
        _QUERY_INSTRUCTION + text,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()
