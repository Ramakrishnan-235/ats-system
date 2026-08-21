# ats-core

Core engine for the AI-powered Applicant Tracking System.

## Architecture & Workflow Documentation
See the root **[WORKFLOW.md](../WORKFLOW.md)** for complete end-to-end architecture diagrams, module breakdown, and dataflow specifications.

## Modules

- `ats_core.parsers`:
  - `pdf_parser.py`: `HybridPDFParser` and `PDFLayoutAnalyzer` (PyMuPDF + Docling)
  - `anonymizer.py`: `ResumeAnonymizer` (Microsoft Presidio + spaCy NER)
  - `ollama_extractor.py`: `OllamaCandidateExtractor` (Ollama + Instructor)
- `ats_core.schema`:
  - `candidate.py`: `CandidateProfile`, `EducationEntry`, `CertificationEntry`, `ProjectEntry`
  - `skills.py`: `SkillsTaxonomy`, `ExtractedSkill`, `SkillCategory`, `SkillProficiency`
  - `timeline.py`: `EmploymentTimeline`, `WorkExperience`, `EmploymentGap`
- `ats_core.search`:
  - `dense_embedder.py`: `DenseEmbedder` (FastEmbed `BAAI/bge-small-en-v1.5`)
  - `bm25_indexer.py`: `BM25LexicalIndex` (BM25Okapi with technical tokenization)
  - `hybrid_retriever.py`: `HybridCandidateRetriever` (Reciprocal Rank Fusion)
- `ats_core.db`:
  - `init_db.py`: Database table & index initialization
  - `vector_store.py`: Async PostgreSQL pgvector store with multi-field payload filters
- `ats_core.models.db`:
  - SQLAlchemy 2.0 ORM models (`Candidate`, `JobPosting`, `Application`, `ScoringAudit`)

## Running Tests & Benchmarks

```bash
# Provision DB
uv run python -m ats_core.db.init_db

# Schema Tests
uv run python test/test_schema.py

# Validation Gates
uv run python test/resume_validation_gate.py
uv run python benchmark_recall.py
uv run python test/test_vector_search.py
```
