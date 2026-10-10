# Resume extraction baseline

Synthetic pilot; not production accuracy evidence.

Mode: **rules**. Split: **all**.
Reference date: 2026-10-10.

| Documents | Completed | Failed | Timed out | Fallback observed |
|---:|---:|---:|---:|---:|
| 10 | 8 | 2 | 0 | 0 |

## Approved-catalog skill extraction

Precision: **91.3%**. Recall: **77.8%**. F1: **84.0%**.

Failures count as missed expected facts. Unknown catalog skills are reported separately.
Catalog gaps: orbitqueryx.

| Category | Documents | Completed | Precision | Recall |
|---|---:|---:|---:|---:|
| aliases | 1 | 1 | 100.0% | 100.0% |
| missing_fields_catalog_gap | 1 | 1 | 100.0% | 100.0% |
| negation_attribution | 1 | 1 | 50.0% | 100.0% |
| paraphrase | 1 | 1 | 100.0% | 100.0% |
| scanned | 2 | 0 | not defined | 0.0% |
| single_column | 2 | 2 | 100.0% | 100.0% |
| two_column | 2 | 2 | 100.0% | 100.0% |

## Fields and complete employment entries

| Field | Correct / Total | Accuracy |
|---|---:|---:|
| name | 8 / 10 | 80.0% |
| email | 8 / 10 | 80.0% |
| phone | 8 / 10 | 80.0% |
| location | 7 / 10 | 70.0% |
| linkedin | 8 / 10 | 80.0% |
| highest_education | 8 / 10 | 80.0% |

Employment entry precision: 0.0%; recall: 0.0%.

## Evidence

Source-grounded mentions: 100.0%.
Strict positive-gold-quote support: 39.5%.
Parser-supplied page reference coverage: 0.0%.
Source containment alone does not establish positive skill evidence. Quote support is a strict proxy, not an entailment score.

## Runtime and limitations

{
  "samples": 10,
  "median_seconds": 5.5667710529999965,
  "p95_seconds": 25.36568735199998,
  "scope": "isolated process wall time including imports; timeouts included"
}

Each case uses a new process; this includes dependency/model initialization and is not steady-state worker latency.
Configured model responses observed: 0 documents.
This measures the parser used by ingest, not upload/queue/storage/database/end-to-end latency.
Gold labels are fixture-author checked; independent recruiter annotation is pending.

## Per-document errors

- synthetic-001 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-002 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-003 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-004 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-005 (failed): field:email: 1, field:highest_education: 1, field:linkedin: 1, field:location: 1, field:name: 1, field:phone: 1, missed_employment: 1, missed_skill: 3, processing:failed: 1
- synthetic-006 (failed): field:email: 1, field:highest_education: 1, field:linkedin: 1, field:location: 1, field:name: 1, field:phone: 1, missed_employment: 1, missed_skill: 3, processing:failed: 1
- synthetic-007 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-008 (completed): incorrect_employment: 1, missed_employment: 1
- synthetic-009 (completed): incorrect_employment: 1, missed_employment: 1, unsupported_skill: 2
- synthetic-010 (completed): catalog_gap: 1, field:location: 1, incorrect_employment: 1
