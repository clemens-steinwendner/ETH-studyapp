"""
Model-loading tests for RAG improvements.

These tests actually load BAAI/bge-large-en-v1.5 and BAAI/bge-reranker-base.
First run will download ~1.3 GB + ~400 MB. Subsequent runs are fast (cached).

Run with:   pytest -m slow
Skip with:  pytest -m "not slow"   (default for CI)
"""
import pytest


@pytest.mark.slow
class TestEmbedderModel:
    def test_embed_texts_returns_1024_dims(self):
        from app.services.ingestion.embedder import embed_texts
        vecs = embed_texts(["test sentence about thermodynamics"])
        assert len(vecs) == 1
        assert len(vecs[0]) == 1024, (
            f"Expected 1024-dim (bge-large-en-v1.5), got {len(vecs[0])}. "
            "Did the model upgrade apply?"
        )

    def test_embed_query_returns_1024_dims(self):
        from app.services.ingestion.embedder import embed_query
        vec = embed_query("What is entropy in thermodynamics?")
        assert len(vec) == 1024

    def test_query_embedding_differs_from_doc_embedding(self):
        """embed_query adds an instruction prefix → different vector from embed_texts."""
        from app.services.ingestion.embedder import embed_texts, embed_query
        text = "entropy is a measure of thermodynamic disorder"
        doc_vec = embed_texts([text])[0]
        query_vec = embed_query(text)
        assert doc_vec != query_vec, (
            "embed_query and embed_texts should produce different vectors "
            "because embed_query prepends the BGE instruction prefix."
        )

    def test_embeddings_are_normalised(self):
        """normalize_embeddings=True means each vector has unit L2 norm."""
        import math
        from app.services.ingestion.embedder import embed_texts, embed_query
        doc_vec = embed_texts(["some text"])[0]
        query_vec = embed_query("some query")
        doc_norm = math.sqrt(sum(x ** 2 for x in doc_vec))
        query_norm = math.sqrt(sum(x ** 2 for x in query_vec))
        assert abs(doc_norm - 1.0) < 1e-3, f"Document embedding not unit-normalised: norm={doc_norm}"
        assert abs(query_norm - 1.0) < 1e-3, f"Query embedding not unit-normalised: norm={query_norm}"

    def test_relevant_chunk_scores_higher_than_irrelevant(self):
        """A chunk about entropy should score higher than one about cooking for an entropy query."""
        from app.services.ingestion.embedder import embed_texts, embed_query
        query_vec = embed_query("What is entropy in thermodynamics?")
        relevant_vec = embed_texts(["Entropy is a thermodynamic quantity representing disorder. S = k ln W."])[0]
        irrelevant_vec = embed_texts(["To make pasta, boil water and add salt before adding the noodles."])[0]
        # Cosine similarity (vectors are already normalised — just dot product)
        sim_relevant = sum(a * b for a, b in zip(query_vec, relevant_vec))
        sim_irrelevant = sum(a * b for a, b in zip(query_vec, irrelevant_vec))
        assert sim_relevant > sim_irrelevant, (
            f"Expected entropy chunk to score higher (got {sim_relevant:.3f}) "
            f"than cooking chunk (got {sim_irrelevant:.3f})"
        )


@pytest.mark.slow
class TestRerankerModel:
    def test_reranker_ranks_relevant_chunk_first(self):
        """The real reranker should rank a relevant chunk above an irrelevant one."""
        from app.vector_db.reranker import rerank
        from app.vector_db.retriever import RetrievedChunk

        query = "Explain the concept of entropy in thermodynamics"
        chunks = [
            RetrievedChunk(
                text="Entropy is a measure of disorder in a thermodynamic system. "
                     "The second law states that entropy never decreases in an isolated system.",
                document_id=1, page=0, score=0.4,
            ),
            RetrievedChunk(
                text="The Roman Empire fell in 476 AD when Romulus Augustulus was deposed "
                     "by the Germanic chieftain Odoacer.",
                document_id=1, page=1, score=0.6,  # higher initial score — reranker should fix this
            ),
            RetrievedChunk(
                text="A linked list is a data structure where each node contains a pointer "
                     "to the next element.",
                document_id=1, page=2, score=0.5,
            ),
        ]
        result = rerank(query, chunks, top_k=3)
        assert result[0].text.startswith("Entropy"), (
            "The thermodynamics chunk should be ranked first by the cross-encoder, "
            f"but got: {result[0].text[:60]!r}"
        )
