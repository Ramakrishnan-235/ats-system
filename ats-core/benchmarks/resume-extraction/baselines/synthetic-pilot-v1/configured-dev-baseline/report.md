# Resume extraction baseline

Synthetic pilot; not production accuracy evidence.

Mode: **configured**. Split: **dev**.
Reference date: 2026-10-10.

| Documents | Completed | Failed | Timed out | Fallback observed |
|---:|---:|---:|---:|---:|
| 5 | 3 | 2 | 0 | 0 |

## Approved-catalog skill extraction

Precision: **100.0%**. Recall: **57.1%**. F1: **72.7%**.

Failures count as missed expected facts. Unknown catalog skills are reported separately.
Catalog gaps: none.

| Category | Documents | Completed | Precision | Recall |
|---|---:|---:|---:|---:|
| paraphrase | 1 | 1 | 100.0% | 100.0% |
| scanned | 2 | 0 | not defined | 0.0% |
| single_column | 1 | 1 | 100.0% | 100.0% |
| two_column | 1 | 1 | 100.0% | 100.0% |

## Fields and complete employment entries

| Field | Correct / Total | Accuracy |
|---|---:|---:|
| name | 3 / 5 | 60.0% |
| email | 3 / 5 | 60.0% |
| phone | 3 / 5 | 60.0% |
| location | 3 / 5 | 60.0% |
| linkedin | 3 / 5 | 60.0% |
| highest_education | 3 / 5 | 60.0% |

Employment entry precision: 0.0%; recall: 0.0%.

## Evidence

Source-grounded mentions: 100.0%.
Strict positive-gold-quote support: 53.3%.
Parser-supplied page reference coverage: 0.0%.
Source containment alone does not establish positive skill evidence. Quote support is a strict proxy, not an entailment score.

## Runtime and limitations

{
  "samples": 5,
  "median_seconds": 26.89289358999997,
  "p95_seconds": 60.44315468599996,
  "scope": "isolated process wall time including imports; timeouts included"
}

Each case uses a new process; this includes dependency/model initialization and is not steady-state worker latency.
Configured model responses observed: 3 documents.
This measures the parser used by ingest, not upload/queue/storage/database/end-to-end latency.
Gold labels are fixture-author checked; independent recruiter annotation is pending.

## Per-document errors

- synthetic-001 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-003 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-005 (failed): field:email: 1, field:highest_education: 1, field:linkedin: 1, field:location: 1, field:name: 1, field:phone: 1, missed_employment: 1, missed_skill: 3, processing:failed: 1
- synthetic-006 (failed): field:email: 1, field:highest_education: 1, field:linkedin: 1, field:location: 1, field:name: 1, field:phone: 1, missed_employment: 1, missed_skill: 3, processing:failed: 1
- synthetic-008 (completed): incorrect_employment: 1, missed_employment: 1
