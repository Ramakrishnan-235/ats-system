# ATS Core Go

Go 1.27 REST backend for the ATS frontend. State is stored in memory, and uploaded
PDFs are stored locally. A restart loses candidates, jobs, taxonomy changes and
upload task state. `DATABASE_URL` currently does not enable persistence.

This implementation uses lexical token-frequency ranking and rank-based reranking;
it does not implement a dense-vector index, BM25 corpus IDF or multi-channel hybrid
retrieval. Latency, RAM and throughput claims require representative benchmarks.

## Run locally

Install Go 1.27, export configuration into the process environment, then run:

```powershell
$env:ATS_API_KEY = '<your unique API key>'
go test ./...
go vet ./...
go run ./cmd/server
```

The server defaults to port 8000. `.env.example` lists environment variables;
the server does **not** automatically load a `.env` file. Authentication is enabled
by default and startup rejects an empty key. Set `ATS_AUTH_ENABLED=false` only for
an intentional local development setup. The API accepts `X-API-Key` or bearer
authentication. Configure browser origins with `ATS_CORS_ORIGINS`.

Uploads default to 10 MiB (`ATS_MAX_UPLOAD_BYTES`) in `ATS_UPLOAD_DIR`. The service
supports a limited subset of uncompressed literal PDF text. Compressed, encrypted,
image-only, and unsupported encoded PDFs need a full extraction/OCR service.
No citation coordinates are returned because this parser cannot verify them.

## Model evaluation

`ATS_LLM_ENABLED=false` is the default. To enable inference, explicitly set it to
`true` and configure Ollama or OpenRouter. A nonempty `OPENROUTER_API_KEY` selects
OpenRouter; otherwise the configured Ollama endpoint is selected. Provider failure
does not silently change destinations and does not generate fallback match scores.
Known identifiers are masked before inference, but regex masking cannot guarantee
complete PII removal. Establish data-handling policy before enabling cloud models.

Scores require a valid provider result; missing evaluation remains pending or
failed. Job assignment does not imply proof of candidate skills or experience.

## API and frontend integration

Public health: `GET /health`. Authenticated routes use `/api/v1` for candidates,
jobs, dashboard, matching and taxonomy. Uploads return `202` with an asynchronous
process-local task ID. Poll `/candidates/tasks/{task_id}` until `SUCCESS` or
`FAILURE`; an unknown task returns `404`. Canceling the HTTP request does not cancel
an already accepted background task. The current frontend upload helper needs this
polling lifecycle before end-to-end compatibility can be claimed.

Original PDFs and `include_pii=true` responses contain personal data. The shared
API key has no role or tenant boundary; these endpoints require identity-based
permissions before multi-user production use.

## Docker

```powershell
docker build -t ats-core-go .
docker run --rm -p 8000:8000 -e ATS_API_KEY='<your unique API key>' ats-core-go
```

The container uses a non-root runtime account. Supply explicit configuration and a
suitable volume/permissions for retained PDFs. Docker build and service deployment
are not verified by the offline Go tests. Local uploads and `.env` are excluded
from the image build context.

See [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md) for fixes, validation and remaining
architecture work. Existing `ats-core-server.exe` is not rebuilt by the review;
rebuild from source before running it.
