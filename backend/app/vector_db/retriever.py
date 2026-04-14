"""
Similarity search interface over ChromaDB collections.

Supports metadata filtering for chapter-level context boundaries (FR-07).
Retrieval pipeline:
  1. Embed query with BGE instruction prefix
  2. Fetch top_k*3 candidates from document_chunks
  3. Fetch top_k candidates from diagram_descriptions (merged in)
  4. Cross-encoder rerank combined pool to final top_k
"""
from dataclasses import dataclass

from app.vector_db.client import get_chroma_client
from app.vector_db.collections import DOCUMENT_CHUNKS, DIAGRAM_DESCRIPTIONS
from app.services.ingestion.embedder import embed_query
from app.vector_db.reranker import rerank


@dataclass
class RetrievedChunk:
    text: str
    document_id: int
    page: int
    score: float


def retrieve_chunks(
    query: str,
    document_ids: list[int],
    chapter_ids: list[int] | None = None,
    top_k: int = 8,
) -> list[RetrievedChunk]:
    """
    Retrieve the most relevant document chunks for a query.

    Filters by document_ids and optionally chapter_ids to enforce
    the session context boundary set during session configuration.
    Fetches 3× candidates from text chunks plus candidates from diagram
    descriptions, then cross-encoder reranks to the final top_k.
    """
    client = get_chroma_client()

    # ChromaDB 0.5+ requires explicit $and for compound filters
    if chapter_ids:
        where: dict = {"$and": [
            {"document_id": {"$in": document_ids}},
            {"chapter_id": {"$in": chapter_ids}},
        ]}
    else:
        where = {"document_id": {"$in": document_ids}}

    query_embedding = embed_query(query)
    fetch_k = top_k * 3

    # ── Text chunks ───────────────────────────────────────────────────────────
    text_col = client.get_or_create_collection(DOCUMENT_CHUNKS)
    try:
        r = text_col.query(
            query_embeddings=[query_embedding],
            n_results=min(fetch_k, text_col.count()),
            where=where,
        )
        chunks: list[RetrievedChunk] = [
            RetrievedChunk(
                text=doc,
                document_id=meta["document_id"],
                page=meta.get("page", 0),
                score=1.0 - dist,
            )
            for doc, meta, dist in zip(
                r["documents"][0], r["metadatas"][0], r["distances"][0]
            )
        ]
    except Exception:
        chunks = []

    # ── Diagram descriptions (best-effort) ───────────────────────────────────
    diag_where: dict = {"document_id": {"$in": document_ids}}
    try:
        diag_col = client.get_or_create_collection(DIAGRAM_DESCRIPTIONS)
        diag_count = diag_col.count()
        if diag_count > 0:
            dr = diag_col.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, diag_count),
                where=diag_where,
            )
            for doc, meta, dist in zip(
                dr["documents"][0], dr["metadatas"][0], dr["distances"][0]
            ):
                chunks.append(RetrievedChunk(
                    text=doc,
                    document_id=meta["document_id"],
                    page=meta.get("page", 0),
                    score=1.0 - dist,
                ))
    except Exception:
        pass

    # ── Cross-encoder rerank ──────────────────────────────────────────────────
    return rerank(query, chunks, top_k)
