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

## 📋 Prerequisites

Ensure you have the following installed on your system:

- **Docker & Docker Compose** (for PostgreSQL 16 + pgvector, Redis, and Ollama)
- **Python 3.11+** and [**`uv`**](https://docs.astral.sh/uv/) (recommended for fast dependency management) or `pip`
- **Node.js 18+ or 20+** and **npm** / **pnpm** / **yarn** (for the Next.js frontend)
- **Ollama** (running locally or inside Docker for local LLM inference)

---

## ⚙️ Environment Configuration

### Backend (`ats-core/.env`)
Navigate to `ats-core` and verify/create `.env` (a template is provided in `ats-core/.env.example`):

```bash
# Environment Configuration
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="deepseek-v4-flash:cloud" # or gemma4:e2b

# Database Configuration (PostgreSQL with pgvector)
DATABASE_URL="postgresql+asyncpg://ats_user:ats_password@localhost:5433/ats_db"
SYNC_DATABASE_URL="postgresql://ats_user:ats_password@localhost:5433/ats_db"

# Security & API Authentication (optional for development)
ATS_AUTH_ENABLED="false"
ATS_API_KEY="your-secure-api-key-here"
```

### Frontend (`frontend/.env.local`)
Create `frontend/.env.local` if you need custom API URLs (defaults to `http://localhost:8000/api/v1`):

```bash
NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
```

---

## 🚀 How to Run the Project (Step-by-Step)

### Step 1: Start Infrastructure Services (Docker)
From the root directory of the project, start PostgreSQL (pgvector), Redis, and Ollama:

```bash
docker compose up -d
```

> **Verify Services**: Run `docker compose ps` to ensure `ats-postgres`, `ats-redis`, and `ollama` are healthy and running.

*(Optional)* Pull your target LLM model into Ollama:
```bash
# Pull model in local/container Ollama
ollama pull deepseek-v4-flash:cloud
# or
ollama pull gemma4:e2b
```

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
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
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
| **Ollama LLM** | `localhost:11434` | Local LLM inference server |

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
