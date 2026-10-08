# EmbeddingGemma 2: 768-dimensional setup

The default embedder is `google/embeddinggemma-2` through Sentence Transformers,
with text-only encoders and CPU float32 inference. CUDA can be selected with
`ATS_EMBEDDING_DEVICE=cuda`; BF16 is used when supported. FP16 is never selected.
Candidates, job postings, query validation and fresh SQL schemas use 768 dimensions.
Queries use `task: search result | query: `; documents use `title: none | text: `.
All returned vectors are validated and normalized. Neither an old model nor
synthetic vectors are used when embedding fails.

## Local Windows setup

Use the project's Python environment with `sentence-transformers>=6.1.0` and
`transformers>=5.19.0` (declared in pyproject.toml). The first request downloads
Google's checkpoint. Subsequent requests use the local Hugging Face cache.
The `.env` embedding settings are independent of the generation settings:

```dotenv
ATS_EMBEDDING_BACKEND=sentence_transformers
ATS_EMBEDDING_MODEL=google/embeddinggemma-2
ATS_EMBEDDING_DEVICE=cpu
ATS_EMBEDDING_BATCH_SIZE=16
```

Ollama 0.40.0 on this Windows host rejected both `embeddinggemma-2:270m` and
`embeddinggemma-2:270m-bf16-text` with "requires MLX support". The default therefore
uses Python locally. On a supported Ollama host, explicitly set:

```dotenv
ATS_EMBEDDING_BACKEND=ollama
ATS_EMBEDDING_MODEL=embeddinggemma-2:270m
ATS_EMBEDDING_BASE_URL=http://localhost:11434
ATS_EMBEDDING_TIMEOUT=120
```

The Ollama client calls `/api/embed` with `dimensions: 768` and `truncate: false`.
A Docker client must use the reachable Ollama service hostname rather than localhost.

## Existing PostgreSQL databases

`CREATE TABLE IF NOT EXISTS` cannot change existing vector columns. Back up the
DB, stop API/Celery processes, and apply
`migrations/20261007_embeddinggemma2_768.sql` with a PostgreSQL client. It renames
old embedding columns/indexes to `*_legacy_pre_gemma2`, preserving their vectors,
and creates new nullable `vector(768)` columns and cosine HNSW indexes. It does
not pad or truncate incompatible old vectors. New columns stay NULL until reindexed.

From the `ats-core` directory, with PostgreSQL running and `.env` DB settings set:

```powershell
.\.venv\Scripts\python.exe -m ats_core.search.reindex_embeddings
```

The command regenerates candidate vectors from `raw_anonymized_text` and job
vectors from `job_description`. Nonempty documents only are indexed. Completed
batches are committed, and reruns skip existing new vectors. `--all` explicitly
regenerates non-NULL vectors too. Restart API/Celery after reindexing to rebuild
in-memory candidate and taxonomy indexes. Keep legacy columns until rollback
requirements are met. Dimension equality does not make different models compatible.

EmbeddingGemma 2 has an 8,192-token context. Native Ollama refuses overlong input;
Sentence Transformers truncates beyond its model limit. Long resumes should be
split by section before retrieval indexing if all document evidence must be retained.

Go currently uses a separate lexical candidate matcher; this change configures
Python dense retrieval, taxonomy normalization, and PostgreSQL document embeddings.
It does not turn Go's lexical matcher into a dense vector service.

References: https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2
and https://docs.ollama.com/api/embed

## Verified local setup on 2026-10-07

- Installed Sentence Transformers 6.1.0 and Transformers 5.19.0; dependency check passed.
- Downloaded Google's checkpoint and generated real 768-dimensional document/query vectors.
- Resume retrieval smoke test scored the relevant Python document 0.8837 versus 0.6028 for the unrelated design document.
- Started Docker Desktop and the local PostgreSQL service; no API/Celery writers were detected.
- Created a database backup at `../../.local-backups/ats-before-embeddinggemma2-20261007.dump` (Git ignored).
- Applied the preserving migration: both new columns are vector(768), both legacy columns remain vector(384), and cosine HNSW indexes exist.
- Reindexed all 50 job postings; the database contained zero candidates.
- Verified real pgvector nearest-neighbor querying; all 50 stored job vectors have 768 dimensions.
- Verified resumable reindex skips completed rows.
- 109 focused retrieval/worker/API/evaluation tests passed; lockfile and Python checks passed.

## Docker model services

`docker compose up -d --build ollama embeddinggemma2` runs generation and embeddings
in containers with persistent model volumes. Ollama runs `gemma4:e2b`; initialize it
with `docker compose exec ollama ollama pull gemma4:e2b`.

EmbeddingGemma 2's published Ollama package requires MLX and cannot run in a Linux
Docker container. The `embeddinggemma2` service runs the exact Google checkpoint
through Sentence Transformers instead. Its `/api/embed` endpoint always returns
768 dimensions, enforces the 8192-token input limit, and accepts the already-prefixed
inputs produced by the project's DenseEmbedder. It does not substitute another model.

Host Python settings:

```dotenv
OLLAMA_BASE_URL=http://localhost:11435/v1
OLLAMA_MODEL=gemma4:e2b
LLM_BASE_URL=http://localhost:11435/v1
LLM_MODEL=gemma4:e2b
ATS_EMBEDDING_BACKEND=http
ATS_EMBEDDING_BASE_URL=http://localhost:8001
ATS_EMBEDDING_MODEL=google/embeddinggemma-2
```

Docker clients use `http://ollama:11434/v1` for generation and
`http://embeddinggemma2:8001` for embeddings. The Go Compose service is configured
for local Gemma generation; its matcher still uses lexical matching. Use
`docker compose ps` and the embedding `/health` endpoint to verify readiness.
The embedding port binds to localhost; model weights are kept in `embedding_models`.

Ollama has GPU access on the verified RTX 2050 host, one parallel request, one
loaded model and a five-minute keep-alive. Embeddings run on CPU. Hosts without
an NVIDIA Docker GPU runtime must remove `gpus: all` to run generation on CPU.

Docker Ollama binds to `127.0.0.1:11435` to avoid the native Windows Ollama
listener on port 11434. Both published model-service ports are local-only.

## Verified Docker setup on 2026-10-07

- Built the text-only CPU image with Torch 2.13.0+cpu, Torchvision 0.28.0+cpu,
  Sentence Transformers 6.1.0, Transformers 5.19.0 and the processor dependencies.
- Seeded the persistent Docker model volume from the previously verified Google checkpoint cache.
- The container starts successfully and its health endpoint reports 768 dimensions.
- The project HTTP client generated real normalized 768-dimensional document/query vectors;
  the relevant Python resume scored 0.8551 versus 0.6357 for the unrelated design resume.
- Internal Docker-hostname embedding requests also returned real normalized 768-dimensional vectors.
- 39 embedding service/client/retrieval regression checks passed.
- Downloaded the complete `gemma4:e2b` package (4.6 GB) into the persistent Ollama volume.
- Restarted Docker Ollama 0.35.1 with GPU access, localhost port 11435 and a model-aware health check.
- Verified native generation returned `READY`; the project LLM client also returned `READY` through `/v1` in 15.86 seconds.
- Ollama uses the RTX 2050 and keeps some model layers in system memory. The first cold request was slow; this is a setup smoke test, not an ATS quality or throughput benchmark.
- Both model containers report healthy.
