# AI-Powered Applicant Tracking System (ATS)

An enterprise-grade, privacy-first, AI-driven Applicant Tracking System (ATS) core engine featuring asynchronous resume ingestion workers (Celery + Redis), intelligent layout parsing, PII de-identification, structured LLM extraction, multi-channel hybrid vector/lexical retrieval, and deep Cross-Encoder re-ranking.

---

## 🌟 Key Features

- ⚡ **Asynchronous Background Processing**: Non-blocking ingestion via FastAPI (`202 Accepted`) and Celery worker processes backed by Redis with exponential backoff retries and randomized jitter.
- 📄 **Hybrid PDF Layout Parsing**: Smart layout detection routing single-column resumes through fast PyMuPDF and complex multi-column/tabular resumes through Docling deep vision parsing.
- 🔒 **PII Redaction & Bias Mitigation**: Presidio-powered redaction of candidate names, emails, phone numbers, and locations before LLM processing for strict compliance and unbiased screening.
- 🧠 **Structured LLM Extraction & Evaluation**: Local LLM execution via Ollama (`gemma4:e2b`) using `instructor` strictly validated against Pydantic v2 schemas.
- 🎯 **3-Stage Candidate Retrieval Funnel**:
  - **Stage 1 (Hybrid Retrieval)**: Dense embeddings (`BAAI/bge-small-en-v1.5`) + domain-tailored BM25 lexical search with Reciprocal Rank Fusion (RRF) -> Top 100.
  - **Stage 2 (Cross-Encoder Re-Ranking)**: Deep full cross-attention via `BAAI/bge-reranker-large` -> Top 20 (filters false-positive keyword stuffers).
  - **Stage 3 (Deep LLM Scoring)**: Rubric criteria evaluation, verbatim citations, pros/cons, and recommended interview questions.
- 🗄️ **PostgreSQL 16 + pgvector**: HNSW vector indexing (`vector_cosine_ops`) paired with multi-payload B-tree and GIN filter indexes.
- ⚖️ **Immutable Scoring & Audit Ledger**: Comprehensive evaluation ledger capturing criteria breakdown, pros/cons, recommended questions, and LLM telemetry.

---

## 📖 Detailed Documentation & Workflow

For the complete architectural design, sequence diagrams, and end-to-end component deep dive, see:
👉 **[WORKFLOW.md](WORKFLOW.md)**

---

## 🚀 Quick Start

### 1. Start Services (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
cd ats-core
uv sync
```

### 3. Provision Database Schema
```bash
uv run python -m ats_core.db.init_db
```

### 4. Start Celery Worker
```bash
uv run celery -A ats_core.workers.celery_app worker --loglevel=info --concurrency=4
```

### 5. Start FastAPI Server
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Run Test Suites
```bash
# Test LLM Candidate Evaluation Latency (< 3s target & 0 rate-limit drops)
uv run python benchmark_evaluation_latency.py

# Test Asynchronous Background Ingestion & FastAPI Endpoints
uv run python test_async_pipeline.py

# Test Stage 3 Deep Evaluator (gemma4:e2b)
uv run python test_deep_evaluator.py

# Test Stage 2 Cross-Encoder Re-Ranker (BAAI/bge-reranker-large)
uv run python test_reranker.py

# Run Full Pytest Suite (9 tests)
uv run python -m pytest test/
```
