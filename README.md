# AI-Powered Applicant Tracking System (ATS)

An enterprise-grade, privacy-first, AI-driven Applicant Tracking System (ATS) core engine featuring asynchronous resume ingestion workers (Celery + Redis), intelligent layout parsing, PII de-identification, structured LLM extraction, multi-channel hybrid vector/lexical retrieval, and deep Cross-Encoder re-ranking.

---

## 🌟 Key Features

- ⚡ **Asynchronous Background Processing**: Non-blocking ingestion via FastAPI (`202 Accepted`) and Celery worker processes backed by Redis with exponential backoff retries and randomized jitter.
- 📄 **Hybrid PDF Layout Parsing**: Smart layout detection routing single-column resumes through fast PyMuPDF and complex multi-column/tabular resumes through Docling deep vision parsing.
- 🔒 **PII Redaction & Bias Mitigation**: Presidio-powered redaction of candidate names, emails, phone numbers, and locations before LLM processing for strict compliance and unbiased screening.
- 🧠 **Structured LLM Extraction & Evaluation**: Local LLM execution via Ollama (`gemma4:e2b`) using `instructor` strictly validated against Pydantic v2 schemas.
- 🎯 **3-Stage Candidate Retrieval Funnel**:
  - **Stage 1 (Hybrid Retrieval)**: Dense embeddings (`google/embeddinggemma-2`) + domain-tailored BM25 lexical search with Reciprocal Rank Fusion (RRF) -> Top 100.
  - **Stage 2 (Cross-Encoder Re-Ranking)**: Deep full cross-attention via `BAAI/bge-reranker-large` -> Top 20 (filters false-positive keyword stuffers).
  - **Stage 3 (Deep LLM Scoring)**: Rubric criteria evaluation, verbatim citations, pros/cons, and recommended interview questions.
- 🗄️ **PostgreSQL 16 + pgvector**: HNSW vector indexing (`vector_cosine_ops`) paired with multi-payload B-tree and GIN filter indexes.
- ⚖️ **Immutable Scoring & Audit Ledger**: Comprehensive evaluation ledger capturing criteria breakdown, pros/cons, recommended questions, and LLM telemetry.

---

## 📖 Detailed Documentation & Workflow

For the complete architectural design, sequence diagrams, and end-to-end component deep dive, see:
👉 **[WORKFLOW.md](WORKFLOW.md)**

---

## 📋 Prerequisites

Ensure you have the following installed on your system:

- **Docker & Docker Compose** (for PostgreSQL 16 + pgvector, Redis, and Ollama)
- **Python 3.12** and [**`uv`**](https://docs.astral.sh/uv/) (recommended for fast dependency management) or `pip`
- **Node.js 20.9+** and **npm** / **pnpm** / **yarn** (for the Next.js frontend)
- **Ollama** (running locally or inside Docker for local LLM inference)

---

## ⚙️ Environment Configuration

### Backend (`ats-core/.env`)
Navigate to `ats-core` and verify/create `.env` (a template is provided in `ats-core/.env.example`):

```bash
# Environment Configuration
OLLAMA_BASE_URL="http://localhost:11435/v1"
OLLAMA_MODEL="gemma4:e2b"
LLM_BASE_URL="http://localhost:11435/v1"
LLM_MODEL="gemma4:e2b"
ATS_EMBEDDING_BACKEND="http"
ATS_EMBEDDING_MODEL="google/embeddinggemma-2"
ATS_EMBEDDING_BASE_URL="http://localhost:8001"

# Database Configuration (PostgreSQL with pgvector)
DATABASE_URL="postgresql+asyncpg://ats_user:ats_password@localhost:5433/ats_db"
SYNC_DATABASE_URL="postgresql://ats_user:ats_password@localhost:5433/ats_db"

# Security & API Authentication
ATS_AUTH_ENABLED="true"
ATS_API_KEY="replace-with-a-unique-secret"
ATS_CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
ATS_MAX_UPLOAD_BYTES="10485760"
```

The API loads `ats-core/.env` without overriding existing environment variables. Authentication
is enabled by default and startup fails if the key is missing. Generate a key with
`python -c "import secrets; print(secrets.token_urlsafe(32))"`. Set `ATS_AUTH_ENABLED=false`
explicitly only for local development. Configure allowed browser origins with
`ATS_CORS_ORIGINS`; uploaded PDFs default to a 10 MiB limit.

Candidate, job, and taxonomy HTTP routes currently use process-local stores. The Celery
worker writes to PostgreSQL through a separate ingestion path. Restarts lose the HTTP
stores, and multiple API processes do not share them. See [the review report](CODE_REVIEW_REPORT.md)
for the implemented hardening and remaining persistence work.

### Frontend (`frontend/.env.local`)
Create `frontend/.env.local` if you need custom API URLs (defaults to `http://localhost:8000/api/v1`):

```bash
NEXT_PUBLIC_API_URL="http://127.0.0.1:8000/api/v1"
# Set false only when the backend explicitly has ATS_AUTH_ENABLED=false locally.
NEXT_PUBLIC_REQUIRE_API_KEY="false"
```

---

## 🚀 How to Run the Project (Step-by-Step)

### Step 1: Start Infrastructure Services (Docker)
From the `ats-system` directory, start PostgreSQL, Redis and the Docker AI services.
The following run instructions use the Python API for dense retrieval and evaluation:

```bash
docker compose up -d postgres redis ollama embeddinggemma2
```

> **Verify Services**: Run `docker compose ps` to ensure `ats-postgres`, `ats-redis`, `ollama`, and `ats-embeddinggemma2` are healthy and running.

For a fresh Ollama model volume, pull Gemma into the container:
```bash
# Pull into Docker Ollama, rather than the native Windows installation
docker compose exec ollama ollama pull gemma4:e2b
```

EmbeddingGemma 2 runs in its separate CPU container because its published Ollama
package requires MLX. See [the model setup and preserving database migration](ats-core/docs/vector-dimension-migration.md)
for the embedding volume, 768-dimensional schema and reindex instructions.

---

### Step 2: Set Up & Run Backend (`ats-core`)

Open a terminal window and execute:

```bash
cd ats-core

# 1. Install dependencies
uv sync

# 2. Provision PostgreSQL Database Schema & pgvector Extensions
uv run python -m ats_core.db.init_db

# 3. (Optional) Seed sample job requisitions
uv run python seed_jobs.py

# 4. Start Celery Ingestion Worker
uv run celery -A ats_core.workers.celery_app worker --loglevel=info --concurrency=4
```

> 💡 **Note for Windows Users**: If Celery's default process pool encounters permission or multiprocessing issues on Windows, run with `-P solo`:
> ```bash
> uv run celery -A ats_core.workers.celery_app worker --loglevel=info -P solo
> ```

In a **separate terminal**, start the **FastAPI Backend Server**:

```bash
cd ats-core
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

### Step 3: Set Up & Run Frontend (`frontend`)

In a **separate terminal**, set up and start the Next.js frontend:

```bash
cd frontend

# 1. Install Node.js dependencies
npm install

# 2. Start the development server
npm run dev
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🌐 Service Ports & Access Points

| Service | Address / URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | Recruiter dashboard, pipeline & matching UI |
| **FastAPI Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **FastAPI Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | API health endpoint |
| **PostgreSQL (pgvector)** | `localhost:5433` | Database (`ats_db`, user: `ats_user`) |
| **Redis** | `localhost:6379` | Celery broker & result backend |
| **Docker Ollama LLM** | `localhost:11435` | Gemma 4 E2B generation |
| **Embedding service** | `localhost:8001` | EmbeddingGemma 2, 768 dimensions |

---

## 🧪 Testing, Benchmarks & Validation

Run test suites and benchmarks from the `ats-core/` directory:

```bash
cd ats-core

# Run Full Pytest Suite (All unit & integration tests)
uv run python -m pytest test/

# Benchmark LLM Candidate Evaluation Latency (< 3s target & 0 rate-limit drops)
uv run python benchmark_evaluation_latency.py

# Benchmark Retrieval Recall (Dense vs BM25 vs Hybrid Recall@K)
uv run python benchmark_recall.py

# Test Asynchronous Background Ingestion & FastAPI Endpoints
uv run python test_async_pipeline.py

# Test Stage 3 Deep Evaluator (Ollama)
uv run python test_deep_evaluator.py

# Test Stage 2 Cross-Encoder Re-Ranker (BAAI/bge-reranker-large)
uv run python test_reranker.py

# Verify Hybrid Search RRF Logic
uv run python verify_hybrid_search.py
```

---

## 📬 Sample API Usage (cURL)

### 1. Upload Resume Asynchronously (HTTP 202 Accepted)
```bash
curl -X POST "http://localhost:8000/api/v1/candidates/upload-async" \
  -H "Accept: application/json" \
  -F "file=@sample_resume.pdf"
```

*Sample Response*:
```json
{
  "status": "QUEUED",
  "task_id": "8f3b6140-5a52-472e-8d8a-6b5cf0bf2553",
  "message": "Resume uploaded successfully. Ingestion queued.",
  "check_status_url": "/api/v1/candidates/tasks/8f3b6140-5a52-472e-8d8a-6b5cf0bf2553"
}
```

### 2. Poll Ingestion Task Status
```bash
curl "http://localhost:8000/api/v1/candidates/tasks/<TASK_ID>"
```

### 3. Evaluate Candidate Matches for a Job Requisition
```bash
curl -X POST "http://localhost:8000/api/v1/match/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_01",
    "top_k": 5
  }'
```
