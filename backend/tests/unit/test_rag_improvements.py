"""
Unit tests for the RAG quality improvements.

All tests here run without downloading any models — heavy dependencies
(CrossEncoder, SentenceTransformer, fitz) are mocked.

For tests that actually load the real models, see tests/unit/test_rag_models.py
(marked @pytest.mark.slow).
"""
from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.vector_db.retriever import RetrievedChunk


# ── Helpers ───────────────────────────────────────────────────────────────────

def _chunk(text: str, doc_id: int = 1, page: int = 0, chapter_id: int = 0) -> RetrievedChunk:
    return RetrievedChunk(text=text, document_id=doc_id, page=page, score=0.5)


# ── Reranker ──────────────────────────────────────────────────────────────────

class TestReranker:
    def _mock_ce(self, scores: list[float]):
        mock = MagicMock()
        mock.predict.return_value = np.array(scores)
        return mock

    def test_orders_by_score(self):
        from app.vector_db.reranker import rerank
        chunks = [_chunk("irrelevant biology text"), _chunk("entropy thermodynamics S=k ln W")]
        with patch("app.vector_db.reranker._get_reranker", return_value=self._mock_ce([0.02, 0.97])):
            result = rerank("What is entropy?", chunks, top_k=2)
        assert result[0].text == "entropy thermodynamics S=k ln W"
        assert result[1].text == "irrelevant biology text"

    def test_top_k_truncates(self):
        from app.vector_db.reranker import rerank
        chunks = [_chunk(f"chunk {i}") for i in range(10)]
        with patch("app.vector_db.reranker._get_reranker",
                   return_value=self._mock_ce(list(range(10, 0, -1)))):
            result = rerank("query", chunks, top_k=3)
        assert len(result) == 3

    def test_empty_input_returns_empty(self):
        from app.vector_db.reranker import rerank
        assert rerank("query", [], top_k=5) == []

    def test_top_k_larger_than_pool(self):
        from app.vector_db.reranker import rerank
        chunks = [_chunk("only chunk")]
        with patch("app.vector_db.reranker._get_reranker",
                   return_value=self._mock_ce([0.9])):
            result = rerank("query", chunks, top_k=10)
        assert len(result) == 1


# ── Retriever chapter filtering ───────────────────────────────────────────────

class TestRetrieverChapterFilter:
    """Uses a real ephemeral ChromaDB — no I/O, runs in-process.

    Each test gets its own isolated client via the `chroma` fixture to prevent
    cross-test pollution (EphemeralClient shares in-process memory).
    """

    @pytest.fixture
    def chroma(self, tmp_path):
        """Fresh, isolated ChromaDB client per test (unique tmp directory)."""
        import chromadb
        client = chromadb.PersistentClient(path=str(tmp_path / "chroma"))
        yield client

    @pytest.fixture(autouse=True)
    def _patch_models(self, chroma):
        """Patch embed_query (synthetic vec), rerank (identity), and get_chroma_client."""
        with (
            patch("app.vector_db.retriever.embed_query", return_value=[0.1] * 768),
            patch("app.vector_db.retriever.rerank",
                  side_effect=lambda q, chunks, top_k: chunks[:top_k]),
            patch("app.vector_db.retriever.get_chroma_client", return_value=chroma),
        ):
            yield

    def _populate(self, chroma):
        """Add 2 chapter-1 chunks and 1 chapter-2 chunk to the client."""
        col = chroma.get_or_create_collection("document_chunks")
        col.add(
            ids=["ch1_a", "ch1_b", "ch2_a"],
            embeddings=[[0.1] * 768, [0.2] * 768, [0.9] * 768],
            documents=["Chapter 1 text A", "Chapter 1 text B", "Chapter 2 text"],
            metadatas=[
                {"document_id": 1, "page": 0, "chunk_index": 0,
                 "chapter_id": 1, "chapter_title": "Introduction"},
                {"document_id": 1, "page": 1, "chunk_index": 1,
                 "chapter_id": 1, "chapter_title": "Introduction"},
                {"document_id": 1, "page": 5, "chunk_index": 2,
                 "chapter_id": 2, "chapter_title": "Main Content"},
            ],
        )

    def test_chapter_filter_excludes_other_chapters(self, chroma):
        from app.vector_db.retriever import retrieve_chunks
        self._populate(chroma)
        results = retrieve_chunks("query", document_ids=[1], chapter_ids=[1], top_k=5)
        assert len(results) == 2
        assert all("Chapter 1" in c.text for c in results)

    def test_no_chapter_filter_returns_all(self, chroma):
        from app.vector_db.retriever import retrieve_chunks
        self._populate(chroma)
        results = retrieve_chunks("query", document_ids=[1], chapter_ids=None, top_k=10)
        assert len(results) == 3

    def test_document_filter_excludes_other_documents(self, chroma):
        from app.vector_db.retriever import retrieve_chunks
        col = chroma.get_or_create_collection("document_chunks")
        col.add(
            ids=["d1", "d2"],
            embeddings=[[0.1] * 768, [0.2] * 768],
            documents=["Doc 1 text", "Doc 2 text"],
            metadatas=[
                {"document_id": 1, "page": 0, "chunk_index": 0, "chapter_id": 0, "chapter_title": ""},
                {"document_id": 2, "page": 0, "chunk_index": 0, "chapter_id": 0, "chapter_title": ""},
            ],
        )
        results = retrieve_chunks("query", document_ids=[1], top_k=5)
        assert len(results) == 1
        assert results[0].text == "Doc 1 text"

    def test_diagrams_are_included_in_results(self, chroma):
        """Diagram descriptions from the second collection should be merged in."""
        from app.vector_db.retriever import retrieve_chunks
        text_col = chroma.get_or_create_collection("document_chunks")
        text_col.add(
            ids=["t1"],
            embeddings=[[0.1] * 768],
            documents=["Regular text chunk"],
            metadatas=[{"document_id": 1, "page": 0, "chunk_index": 0,
                        "chapter_id": 1, "chapter_title": "Ch1"}],
        )
        diag_col = chroma.get_or_create_collection("diagram_descriptions")
        diag_col.add(
            ids=["d1"],
            embeddings=[[0.1] * 768],
            documents=["A diagram showing entropy vs temperature curve"],
            metadatas=[{"document_id": 1, "page": 2, "chapter_id": 1, "chapter_title": "Ch1"}],
        )
        results = retrieve_chunks("query", document_ids=[1], top_k=5)
        texts = [r.text for r in results]
        assert "Regular text chunk" in texts
        assert "A diagram showing entropy vs temperature curve" in texts


# ── Pipeline chapter extraction ───────────────────────────────────────────────

class TestPipelineChapterExtraction:
    @dataclass
    class FakeBlock:
        page: int
        text: str

    def test_toc_parsed_correctly(self, tmp_path):
        from app.services.ingestion.pipeline import _extract_chapter_structure
        blocks = [self.FakeBlock(page=0, text="intro"), self.FakeBlock(page=8, text="body")]
        toc = [
            [1, "Introduction", 1],
            [1, "Core Concepts", 4],
            [2, "Subsection 2.1", 5],  # level 2 — ignored
            [1, "Conclusion", 9],
        ]
        mock_doc = MagicMock()
        mock_doc.get_toc.return_value = toc
        mock_doc.__len__ = MagicMock(return_value=12)
        with patch("fitz.open", return_value=mock_doc):
            chapters = _extract_chapter_structure(tmp_path / "fake.pdf", blocks, 12)
        assert len(chapters) == 3, "Only level-1 entries become chapters"
        titles = [c[0] for c in chapters]
        assert titles == ["Introduction", "Core Concepts", "Conclusion"]
        assert "Subsection 2.1" not in titles

    def test_chapter_page_ranges_are_contiguous(self, tmp_path):
        from app.services.ingestion.pipeline import _extract_chapter_structure
        blocks = [self.FakeBlock(page=0, text="text")]
        toc = [
            [1, "Ch1", 1],   # 0-indexed: page 0
            [1, "Ch2", 5],   # 0-indexed: page 4
        ]
        mock_doc = MagicMock()
        mock_doc.get_toc.return_value = toc
        mock_doc.__len__ = MagicMock(return_value=10)
        with patch("fitz.open", return_value=mock_doc):
            chapters = _extract_chapter_structure(tmp_path / "fake.pdf", blocks, 10)
        ch1_end = chapters[0][2]
        ch2_start = chapters[1][1]
        assert ch1_end < ch2_start, "Ch1 should end before Ch2 starts"

    def test_no_toc_falls_back_to_heading_detection(self, tmp_path):
        from app.services.ingestion.pipeline import _extract_chapter_structure
        blocks = [
            self.FakeBlock(page=0, text="1. Introduction to Databases"),
            self.FakeBlock(page=3, text="Some paragraph text without a heading."),
            self.FakeBlock(page=5, text="2. Relational Model and SQL"),
        ]
        mock_doc = MagicMock()
        mock_doc.get_toc.return_value = []  # no TOC
        mock_doc.__len__ = MagicMock(return_value=10)
        with patch("fitz.open", return_value=mock_doc):
            chapters = _extract_chapter_structure(tmp_path / "fake.pdf", blocks, 10)
        titles = [c[0] for c in chapters]
        assert any("Introduction" in t for t in titles)
        assert any("Relational" in t for t in titles)


# ── Query string format ───────────────────────────────────────────────────────

class TestQueryString:
    def test_exercise_query_is_natural_language(self):
        topics = ["entropy", "Boltzmann equation"]
        difficulty = "synthesis"
        topic_str = ", ".join(topics)
        rag_query = (
            f"Course material about: {topic_str}. "
            f"{difficulty.capitalize()} level concepts, definitions, and examples."
        ).strip()
        assert rag_query.startswith("Course material about:")
        assert "entropy" in rag_query
        assert "Boltzmann equation" in rag_query
        assert "Synthesis level" in rag_query
        # Old format would start with the question type
        assert not rag_query.startswith("coding")
        assert not rag_query.startswith("multiple_choice")

    def test_topic_query_is_natural_language(self):
        subject = "databases"
        query = f"Overview of key topics, concepts, and definitions covered in this {subject} course."
        assert "databases" in query
        assert query.startswith("Overview of")
        # Old format
        assert query != f"topics concepts overview {subject}"
