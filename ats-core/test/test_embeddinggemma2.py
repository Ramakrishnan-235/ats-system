"""EmbeddingGemma transport/encoding regressions without downloading weights."""
import math

import httpx
import pytest

from ats_core.search.dense_embedder import DenseEmbedder


def test_ollama_embeds_queries_and_documents_with_correct_contract(monkeypatch):
    monkeypatch.delenv("ATS_EMBEDDING_MODEL", raising=False)
    seen = []
    def handle(request):
        import json
        body = json.loads(request.content)
        seen.append((str(request.url), body))
        return httpx.Response(200, json={"embeddings": [[2.0] + [0.0]*767 for _ in body["input"]]})
    encoder = DenseEmbedder(backend="ollama", base_url="http://model/v1", transport=httpx.MockTransport(handle))
    documents = encoder.embed_documents(["Python resume", "Java resume"])
    query = encoder.embed_query("Python developer")
    assert seen[0][0] == "http://model/api/embed"
    assert seen[0][1]["input"] == ["title: none | text: Python resume", "title: none | text: Java resume"]
    assert seen[1][1]["input"] == ["task: search result | query: Python developer"]
    assert all(body["dimensions"] == 768 and body["truncate"] is False for _, body in seen)
    assert all(len(v) == 768 and math.hypot(*v) == 1 for v in [*documents, query])
    encoder.close()


@pytest.mark.parametrize("response", [[], [[0.0]*768], [[1.0]*384], [[1.0]*1536], [[1.0]*768, [1.0]*768]])
def test_provider_errors_never_produce_incompatible_or_synthetic_vectors(response):
    encoder = DenseEmbedder(backend="ollama", transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"embeddings": response})))
    with pytest.raises(ValueError):
        encoder.embed_documents(["resume"])
    encoder.close()


def test_http_failure_is_not_hidden():
    encoder = DenseEmbedder(backend="ollama", transport=httpx.MockTransport(
        lambda request: httpx.Response(503, json={"error": "offline"})))
    with pytest.raises(httpx.HTTPStatusError):
        encoder.embed_query("Python")
    encoder.close()


def test_sentence_transformer_encoding_uses_explicit_prefixes():
    from types import SimpleNamespace
    encoder = DenseEmbedder.__new__(DenseEmbedder)
    encoder.backend = "sentence_transformers"
    encoder.batch_size = 16
    seen = []
    def encode(batch, **kwargs):
        seen.append((batch, kwargs))
        return SimpleNamespace(tolist=lambda: [[1.0] + [0.0]*767 for _ in batch])
    encoder.model = SimpleNamespace(encode=encode)
    assert len(encoder.embed_documents(["resume"])[0]) == 768
    assert len(encoder.embed_query("job")) == 768
    assert seen[0][1]["prompt"] == "title: none | text: "
    assert seen[1][1]["prompt"] == "task: search result | query: "
    assert all(kwargs["truncate_dim"] == 768 and kwargs["normalize_embeddings"] for _, kwargs in seen)
