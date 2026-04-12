"""
Similarity search interface over ChromaDB collections.

Supports metadata filtering for chapter-level context boundaries (FR-07).
"""
from dataclasses import dataclass

from app.vector_db.client import get_chroma_client
from app.vector_db.collections import DOCUMENT_CHUNKS, DIAGRAM_DESCRIPTIONS
from app.services.ingestion.embedder import embed_texts


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
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(DOCUMENT_CHUNKS)

    where: dict = {"document_id": {"$in": document_ids}}
    if chapter_ids:
        where["chapter_id"] = {"$in": chapter_ids}

    query_embedding = embed_texts([query])[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
    )

    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        dist = results["distances"][0][i]
        chunks.append(RetrievedChunk(
            text=doc,
            document_id=meta["document_id"],
            page=meta.get("page", 0),
            score=1.0 - dist,
        ))
    return chunks
