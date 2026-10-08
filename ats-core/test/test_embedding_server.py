from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ats_core.search import embedding_server


@pytest.fixture
def client(monkeypatch):
    seen = []
    encoder = SimpleNamespace(
        model=[SimpleNamespace(tokenizer=SimpleNamespace(encode=lambda text: text.split()))],
        close=lambda: None,
        _encode=lambda texts, prefix: seen.append((texts, prefix)) or [[1.0]+[0.0]*767 for _ in texts],
    )
    monkeypatch.setattr(embedding_server, "DenseEmbedder", lambda **kwargs: encoder)
    with TestClient(embedding_server.app) as client:
        yield client, seen


def test_service_preserves_prefix_and_dimension(client):
    api, seen = client
    response = api.post("/api/embed", json={"model":"google/embeddinggemma-2", "input":["title: none | text: Python", "task: search result | query: Python"], "dimensions":768,"truncate":False})
    assert response.status_code == 200
    assert len(response.json()["embeddings"]) == 2
    assert all(len(vector) == 768 for vector in response.json()["embeddings"])
    assert seen == [(["title: none | text: Python", "task: search result | query: Python"], "")]
    assert api.get("/health").json()["dimensions"] == 768


@pytest.mark.parametrize("input", [[], [" "], ["word"] * 65, "word " * 8193], ids=["empty", "blank", "too-many", "too-long"])
def test_service_rejects_bad_or_overlong_batches(client, input):
    api, seen = client
    response = api.post("/api/embed", json={"input":input})
    assert response.status_code == 400
    assert seen == []


@pytest.mark.parametrize("extra", [{"dimensions":384},{"model":"embeddinggemma"},{"truncate":True}])
def test_service_rejects_incompatible_model_contract(client, extra):
    api, seen = client
    assert api.post("/api/embed", json={"input":"Python",**extra}).status_code == 422
    assert seen == []
