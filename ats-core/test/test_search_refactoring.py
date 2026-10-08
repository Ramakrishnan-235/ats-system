"""Offline regression coverage for retrieval, independent of ML models/DBs."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from ats_core.db.vector_store import VectorStore
from ats_core.models.db import Candidate, JobPosting
from ats_core.search.bm25_indexer import BM25LexicalIndex
from ats_core.search.dense_embedder import DenseEmbedder
from ats_core.search.embedding_config import EMBEDDING_DIMENSION, validate_embedding
from ats_core.search.hybrid_retriever import HybridCandidateRetriever
from ats_core.search.pgvector_store import PgVectorStore
from ats_core.search.reranker import CandidateReranker


def test_vector_contract_matches_sql_and_orm():
    assert EMBEDDING_DIMENSION == 768
    assert Candidate.embedding.type.dim == JobPosting.embedding.type.dim == EMBEDDING_DIMENSION
    schema = (Path(__file__).resolve().parents[1] / "schema.sql").read_text()
    assert schema.count(f"embedding vector({EMBEDDING_DIMENSION})") == 2
    assert validate_embedding([1.0] + [0.0] * 767) == [1.0] + [0.0] * 767


@pytest.mark.parametrize("vector", [[1.0] * 1536, [0.0] * 768, [float("nan")] * 768, [float("inf")] * 768])
def test_vector_contract_rejects_invalid_vectors(vector):
    with pytest.raises(ValueError):
        validate_embedding(vector)


def test_dense_encoder_rejects_model_dimension_drift():
    import httpx
    embedder = DenseEmbedder(backend="ollama", transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"embeddings": [[1.0] * 384]})
    ))
    with pytest.raises(ValueError):
        embedder.embed_documents(["resume"])
    embedder.close()


@pytest.mark.asyncio
async def test_invalid_candidate_vector_rejected_before_database_access():
    store = VectorStore.__new__(VectorStore)
    store.session_factory = Mock()
    with pytest.raises(ValueError):
        await store.insert_candidate("Engineer", 1.0, embedding=[1.0] * 1536)
    store.session_factory.assert_not_called()


@pytest.mark.asyncio
async def test_invalid_query_vector_rejected_before_database_access():
    store = VectorStore.__new__(VectorStore)
    store.session_factory = Mock()
    with pytest.raises(ValueError):
        await store.search_candidates_by_vector([float("nan")] * 768)
    store.session_factory.assert_not_called()


def test_candidate_embeddings_use_document_encoding():
    seen = []
    embedder = SimpleNamespace(embed_documents=lambda docs: seen.append(docs) or [[1.0] * 768])
    assert PgVectorStore(embedder).generate_embedding("resume") == [1.0] * 768
    assert seen == [["resume"]]


def test_bm25_preserves_distinct_technical_tokens():
    tokens = BM25LexicalIndex.tokenize("C++ C# C R .NET CI/CD TCP/IP Node.js React-Native")
    assert tokens == ["c++", "c#", "c", "r", ".net", "ci/cd", "tcp/ip", "node.js", "react-native"]


@pytest.mark.parametrize("documents", [["Python"], ["Python", "Java"], ["Python", "Python"]])
def test_bm25_keeps_real_matches_in_small_and_common_term_corpora(documents):
    index = BM25LexicalIndex()
    index.build_index([str(i) for i in range(len(documents))], documents)
    matches = index.search("Python")
    assert {cid for cid, _ in matches} == {str(i) for i, doc in enumerate(documents) if "Python" in doc}
    assert all(score > 0 for _, score in matches)


def test_bm25_cplusplus_is_not_csharp():
    index = BM25LexicalIndex()
    index.build_index(["cpp", "cs"], ["C++", "C#"])
    assert [cid for cid, _ in index.search("C++")] == ["cpp"]


class FakeEmbedder:
    def embed_documents(self, documents):
        return [[1.0, 0.0] for _ in documents]

    def embed_query(self, query):
        return [1.0, 0.0]


def test_hybrid_failed_embedding_batch_preserves_previous_index():
    dense = FakeEmbedder()
    retriever = HybridCandidateRetriever(dense_embedder=dense)
    retriever.index_candidates([{"id": "first", "text": "Python"}])
    dense.embed_documents = lambda docs: []
    with pytest.raises(ValueError):
        retriever.index_candidates([{"id": "second", "text": "Java"}])
    assert list(retriever.candidate_corpus) == ["first"]
    assert retriever.bm25.candidate_ids == ["first"]
    assert list(retriever.dense_embeddings) == ["first"]


def test_hybrid_candidate_updates_replace_both_indexes():
    retriever = HybridCandidateRetriever(dense_embedder=FakeEmbedder())
    retriever.index_candidates([{"id": "first", "text": "Python"}])
    retriever.index_candidates([{"id": "first", "text": "Java"}, {"id": "second", "text": "Python"}])
    assert [cid for cid, _ in retriever.bm25.search("Python")] == ["second"]
    assert len(retriever.dense_embeddings) == 2
    assert retriever.hybrid_search("Python")[0]["text"] == "Python"


def test_cosine_dimension_mismatch_cannot_silently_truncate():
    retriever = HybridCandidateRetriever(dense_embedder=FakeEmbedder())
    with pytest.raises(ValueError):
        retriever._cosine_similarity([1, 0], [1, 0, 1])
    assert retriever.hybrid_search(" ") == []


def test_reranker_orders_saturated_scores_by_raw_precision():
    reranker = CandidateReranker.__new__(CandidateReranker)
    reranker.batch_size = 8
    reranker.model = SimpleNamespace(predict=lambda *args, **kwargs: [10.001, 10.002])
    ranked = reranker.rerank("Python", [{"id": "less", "text": "Python"}, {"id": "more", "text": "Python"}])
    assert [item["id"] for item in ranked] == ["more", "less"]
    assert ranked[0]["rerank_score"] == ranked[1]["rerank_score"]


def test_reranker_formats_real_candidate_metadata_and_core_skills():
    reranker = CandidateReranker.__new__(CandidateReranker)
    text = reranker._format_candidate_text({"metadata": {
        "target_headline": "Backend Engineer", "years_of_experience": 4, "core_skills": ["Python"],
    }})
    assert "Backend Engineer" in text
    assert "4 years" in text
    assert "Python" in text


@pytest.mark.parametrize("score", [float("nan"), float("inf"), -float("inf")])
def test_reranker_rejects_nonfinite_scores(score):
    with pytest.raises(ValueError):
        CandidateReranker._sigmoid(score)
