# Resume extraction baseline

Step 1 adds a read-only benchmark around the parser used by the private ingest worker.
It does not upload resumes, create candidates, write taxonomy records, or change the
application's extraction behavior.

## Dataset

Ten synthetic PDFs cover single columns, two columns, image-only scans, aliases,
paraphrased skills, negation/third-party attribution, missing fields and an unknown tool.
All names, employers and contact details are fictional. Email uses `.invalid` and phone
numbers use the fictional NANP 555-01xx range. The footer identifies synthetic data.

`sources/` contains the authored content; `labels/` contains independently authored
facts and evidence quotes. These are not parser-generated labels. Label status is
`authored`; visual/source checks validate the fixture, but independent human annotation
is pending. Do not represent the pilot's accuracy as real-resume production accuracy.

Development has five documents and test has five. Backend and data resumes have scanned
variants in their original group; frontend canonical/alias variants share another group.
The runner rejects groups appearing in both splits. Shared page rendering alone does
not make two independently authored resumes duplicate content.

`taxonomy.json` is a frozen approved snapshot of the Rust catalog seed. Stable fixture
IDs are generated from canonical names. Rebuilding PDFs preserves that snapshot. To
change it, create a new dataset version rather than silently replacing the snapshot.

## Run from ats-core

On this Windows project, the existing AI Docker container already has the parser's
dependencies. Run this wrapper without installing another Python environment:

```powershell
./scripts/run_resume_benchmark.ps1 -Split dev
./scripts/run_resume_benchmark.ps1 -Mode configured -Split dev -AllowModelNetwork
```

Docker and `ats-architecture-ai-1` must be running; pass `-Container` for another
AI container name. It copies current source and synthetic inputs to an isolated temporary
directory, runs the benchmark, copies reports back to ignored `runs/` and removes the
temporary copy. Existing/private reports are not copied. Application source inside
`/app`, candidate records and normal worker tasks are not modified.

Use the project's Python 3.12 environment with its normal AI dependencies installed:

```powershell
python scripts/build_resume_benchmark.py
python scripts/benchmark_resume_extraction.py --validate-only
python scripts/benchmark_resume_extraction.py --split dev
```

The builder requires ReportLab plus PyMuPDF or Poppler for image-only scans. PDF bytes
are deterministic with the same package versions. Existing non-synthetic source data
is never used by the builder.

For a final held-out run after freezing the new extractor:

```powershell
python scripts/benchmark_resume_extraction.py --split test
```

`--split all` is available for initial inventory/reporting. Once inspecting its test
errors has influenced changes, reserve a fresh independent held-out corpus for final
claims. The initial ten PDFs are a regression pilot, not statistical validation.

Rules mode uses `allow_llm=False` and blocks network access in each child process. It
also sets Hugging Face offline mode, so uncached OCR/model dependencies may fall back
or fail. Those failures are reported, never skipped. This is an offline baseline,
not evidence that live OCR is broken. To allow downloading/loading OCR dependencies:

```powershell
python scripts/benchmark_resume_extraction.py --split dev --allow-model-network
```

Configured extraction is explicitly opt-in because it can call the configured local
or external LLM, initialize anonymization/OCR models and incur provider costs:

```powershell
python scripts/benchmark_resume_extraction.py --mode configured --split dev --allow-model-network
```

That mode honors `ATS_AI_ENABLE_LLM` (default true) and the parser's existing LLM
configuration. A standalone shell does not automatically inherit Docker Compose's
environment. Set the intended model/endpoint in the environment, or execute inside
the existing AI container. Keys are not included in reports. Confirm `llm_config` and
observed response/fallback counters before treating the result as model-assisted.
Candidate-search embedding and job-fit scoring are outside this extraction benchmark.

Every case runs in a fresh process with a configurable `--case-timeout` (90 seconds
default). Timeouts and parser exceptions receive outcomes and count as missed facts.
Exit code 2 means incomplete processing; accuracy findings alone do not fail the CLI.
Reference date defaults to `2026-10-10`; use `--as-of YYYY-MM-DD` to change it explicitly.

## Outputs and interpretation

The default creates a new timestamped directory in ignored `runs/`:

- `run.json`: code, manifest, gold and taxonomy hashes, reference date and settings.
- `predictions.jsonl`: extracted values, real evidence, processing status and diagnostics.
- `scores.json`: per-document metrics and errors.
- `errors.csv`: incorrect/missing skills, catalog gaps, fields and complete employment entries.
- `summary.json`: micro precision/recall/F1, fields, evidence, negative cases, duration,
  completed/failed/timeout counts, categories and splits.
- `report.md`: readable summary and limitations.

Precision = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN).
Undefined denominators produce null, not a fabricated perfect score. Failed documents
count as missing supported facts and incorrect fields, even for expected missing fields.
Employment entries use multiset matching so duplicated entries are penalized.

Source-grounded evidence means its whole sentence occurs in parsed text. Positive-label
support additionally requires a full positive gold quote in that sentence. Neither
automatically proves semantic entailment. Page coverage counts actual parser references.
Cold process duration includes imports and model initialization; median/P95 include
failed/timed-out cases and are not warm worker or end-to-end application latency.

For real data, use a separate private dataset with `permission=consented_evaluation`
and `contains_real_person_data=true`, then explicitly pass `--allow-private-data`.
Reports contain resume text/contact information; store them privately and never commit
them. Default corpus fixtures are exclusively synthetic.

## Extend and validate

Start by independently reviewing this pilot's labels, then add approximately fifty
diverse consented/synthetic resumes with different authors and layouts. Preserve groups
across splits. Do not tune embedding thresholds on test labels.

Run the meaningful benchmark harness tests with:

```powershell
python -m unittest discover -s test -p test_resume_extraction_benchmark.py
```

They test scoring, failure accounting, duplicate employment, evidence grounding,
catalog coverage, corpus tamper detection, dataset split leakage and the process deadline.

## Captured initial baseline

The checked-in `baselines/synthetic-pilot-v1/` snapshots retain the original report,
summary, run fingerprints and errors. Full predictions remain in ignored local runs.

| Run | Documents completed | Skill precision | Skill recall |
|---|---:|---:|---:|
| Offline rules, all | 8 / 10 | 91.3% | 77.8% |
| Offline rules, dev subset | 3 / 5 | 100.0% | 57.1% |
| Configured local Gemma, dev | 3 / 5 | 100.0% | 57.1% |

The two development rows are comparable on the same documents; the all-document row
uses a different population. Three development documents produced actual responses
from `gemma4:e2b`. Both scans returned empty text in offline and network-enabled modes;
the benchmark does not establish the OCR root cause. The current parser also accepts
negated/third-party technologies and uses the `EXPERIENCE` heading as the employer.
Those are recorded defects, not repaired by the baseline implementation.

- [Offline report](baselines/synthetic-pilot-v1/rules-all-baseline/report.md)
- [Configured local-model report](baselines/synthetic-pilot-v1/configured-dev-baseline/report.md)
