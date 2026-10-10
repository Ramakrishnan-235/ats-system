"""Read-only extraction benchmark. No API uploads or candidate/database writes.

Each PDF runs in a fresh process with a deadline. Rules mode has network disabled
unless explicitly enabled for OCR. Configured mode requires a network opt-in.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import logging
import math
import os
import re
import statistics
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = ROOT / "benchmarks" / "resume-extraction"
MISSING = {"", "n/a", "unknown", "unknown company", "unknown role", "candidate", "none"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
                    encoding="utf-8")


def local_path(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise ValueError("Dataset paths must remain inside the dataset")
    return candidate


def normalized(value) -> str:
    if value is None:
        return ""
    result = " ".join(str(value).casefold().split())
    return "" if result in MISSING else result


def pdf_pages(document: bytes) -> list[str]:
    try:
        import fitz
    except ImportError:
        from io import BytesIO
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(document))
        return [page.extract_text() or "" for page in reader.pages]
    with fitz.open(stream=document, filetype="pdf") as pdf:
        return [page.get_text() for page in pdf]


def ratio(numerator: int, denominator: int):
    return numerator / denominator if denominator else None


def set_metrics(expected: set, predicted: set) -> dict:
    tp, fp, fn = len(expected & predicted), len(predicted - expected), len(expected - predicted)
    return {"tp": tp, "fp": fp, "fn": fn, "precision": ratio(tp, tp + fp),
            "recall": ratio(tp, tp + fn), "f1": ratio(2 * tp, 2 * tp + fp + fn)}


def validate_dataset(root: Path) -> tuple[list[dict], list[dict]]:
    taxonomy = read_json(root / "taxonomy.json")
    if not taxonomy or any(row.get("status") != "approved" for row in taxonomy):
        raise ValueError("A nonempty frozen approved taxonomy is required")
    names = [normalized(row["canonical_name"]) for row in taxonomy]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate canonical skills in taxonomy")
    manifest = [json.loads(line) for line in (root / "manifest.jsonl").read_text(
        encoding="utf-8").splitlines() if line.strip()]
    identifiers, groups = set(), {}
    for row in manifest:
        identifier = row["resume_id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", identifier) or identifier in identifiers:
            raise ValueError("Invalid or duplicate resume id")
        identifiers.add(identifier)
        if row["split"] not in {"dev", "test"}:
            raise ValueError("Split must be dev or test")
        group = row["group_id"]
        if group in groups and groups[group] != row["split"]:
            raise ValueError("Resume group leaks across development/test split: " + group)
        groups[group] = row["split"]
        if row.get("permission") not in {"synthetic", "consented_evaluation"}:
            raise ValueError("Document needs explicit evaluation provenance")
        document = local_path(root, row["pdf"]).read_bytes()
        if not document.startswith(b"%PDF-") or sha256(document) != row["sha256"]:
            raise ValueError("PDF signature/hash mismatch: " + identifier)
        pages = pdf_pages(document)
        if len(pages) != row["page_count"]:
            raise ValueError("PDF page count mismatch: " + identifier)
        if row["category"] == "scanned" and any(text.strip() for text in pages):
            raise ValueError("Scanned fixture has a hidden text layer")
        gold = read_json(local_path(root, row["labels"]))
        if gold["resume_id"] != identifier:
            raise ValueError("Label/document id mismatch")
        positives = {normalized(item["canonical_name"]) for item in gold["skills"]}
        negatives = {normalized(item["canonical_name"]) for item in gold["negative_skills"]}
        if positives & negatives:
            raise ValueError("Skill cannot be both supported and unsupported")
        for item in gold["skills"] + gold["negative_skills"]:
            if not item.get("quote") or not 1 <= item["page"] <= row["page_count"]:
                raise ValueError("Gold skill requires a quote and valid page")
            if row["category"] != "scanned" and normalized(item["quote"]) not in normalized(pages[item["page"] - 1]):
                raise ValueError("Gold evidence is not on its annotated PDF page: " + identifier)
        if row.get("source_text"):
            source = local_path(root, row["source_text"]).read_text(encoding="utf-8")
            if sha256(source.encode()) != gold["source_text_sha256"]:
                raise ValueError("Authored source hash mismatch")
            if any(item["quote"] not in source for item in gold["skills"] + gold["negative_skills"]):
                raise ValueError("Gold quote is missing from authored source")
    if not manifest:
        raise ValueError("Empty dataset")
    return manifest, taxonomy


def employment_key(entry: dict) -> tuple:
    # Compare complete entries; month labels accept a more precise day in that same month.
    return (normalized(entry.get("company")), normalized(entry.get("role")),
            normalized(entry.get("start_date"))[:7], normalized(entry.get("end_date"))[:7])


def score_case(row: dict, gold: dict, prediction: dict, taxonomy: list[dict]) -> dict:
    successful = prediction.get("status") == "completed"
    approved = {normalized(item["canonical_name"]) for item in taxonomy}
    expected = {normalized(item["canonical_name"]) for item in gold["skills"]}
    predicted = {normalized(skill) for skill in prediction.get("core_skills", [])} if successful else set()
    eligible = expected & approved
    errors = []
    for skill in sorted(eligible - predicted):
        errors.append({"kind": "missed_skill", "expected": skill, "actual": ""})
    for skill in sorted(predicted - expected):
        errors.append({"kind": "unsupported_skill", "expected": "", "actual": skill})
    for skill in sorted(expected - approved):
        errors.append({"kind": "catalog_gap", "expected": skill, "actual": ""})
    fields = {}
    for key, expected_value in gold["fields"].items():
        actual = prediction.get("fields", {}).get(key)
        correct = successful and normalized(actual) == normalized(expected_value)
        fields[key] = {"correct": int(correct), "total": 1}
        if not correct:
            errors.append({"kind": "field:" + key, "expected": expected_value, "actual": actual})
    # Multiset matching penalizes duplicate/spurious employment entries.
    expected_jobs = Counter(employment_key(item) for item in gold["employment"])
    predicted_jobs = Counter(employment_key(item) for item in prediction.get("experience", [])) if successful else Counter()
    job_tp = sum((expected_jobs & predicted_jobs).values())
    job_fp = sum((predicted_jobs - expected_jobs).values())
    job_fn = sum((expected_jobs - predicted_jobs).values())
    for key, count in (expected_jobs - predicted_jobs).items():
        errors.append({"kind": "missed_employment", "expected": list(key), "actual": "", "count": count})
    for key, count in (predicted_jobs - expected_jobs).items():
        errors.append({"kind": "incorrect_employment", "expected": "", "actual": list(key), "count": count})
    raw = normalized(prediction.get("raw_text"))
    evidence = {"total": 0, "source_grounded": 0, "label_supported": 0, "page_referenced": 0}
    quotes = {}
    for item in gold["skills"]:
        quotes.setdefault(normalized(item["canonical_name"]), []).append(normalized(item["quote"]))
    for item in prediction.get("evidence", []) if successful else []:
        sentence = normalized(item.get("sentence"))
        evidence["total"] += 1
        grounded = bool(sentence) and sentence in raw
        # Whole positive gold quote required; mere keyword containment does not establish support.
        supported = grounded and any(quote in sentence for quote in quotes.get(
            normalized(item.get("canonical_name")), []))
        evidence["source_grounded"] += int(grounded)
        evidence["label_supported"] += int(supported)
        evidence["page_referenced"] += int(isinstance(item.get("page"), int)
                                            and 1 <= item["page"] <= row["page_count"])
        if not grounded:
            errors.append({"kind": "ungrounded_evidence", "expected": "source passage", "actual": sentence})
    if not successful:
        errors.append({"kind": "processing:" + prediction.get("status", "failed"),
                       "expected": "completed", "actual": prediction.get("error_type", "")})
    negatives = {normalized(item["canonical_name"]) for item in gold["negative_skills"]}
    return {
        "resume_id": row["resume_id"], "category": row["category"], "split": row["split"],
        "status": prediction.get("status", "failed"),
        "skills": set_metrics(eligible, predicted), "all_skills": set_metrics(expected, predicted),
        "catalog_missing": sorted(expected - approved), "fields": fields,
        "employment": {"tp": job_tp, "fp": job_fp, "fn": job_fn}, "evidence": evidence,
        "negative_skills": {"total": len(negatives), "incorrectly_extracted": len(negatives & predicted)},
        "errors": errors, "duration_seconds": prediction.get("duration_seconds"),
        "parse_seconds": prediction.get("parse_seconds"), "diagnostics": prediction.get("diagnostics", {}),
    }


def summarize(scores: list[dict]) -> dict:
    def collection_metrics(key):
        counts = {metric: sum(row[key][metric] for row in scores) for metric in ["tp", "fp", "fn"]}
        tp, fp, fn = (counts[metric] for metric in ["tp", "fp", "fn"])
        return {**counts, "precision": ratio(tp, tp + fp), "recall": ratio(tp, tp + fn),
                "f1": ratio(2 * tp, 2 * tp + fp + fn)}

    fields = {}
    for row in scores:
        for field, counts in row["fields"].items():
            current = fields.setdefault(field, {"correct": 0, "total": 0})
            current["correct"] += counts["correct"]
            current["total"] += counts["total"]
    for counts in fields.values():
        counts["accuracy"] = ratio(counts["correct"], counts["total"])
    duration = sorted(row["duration_seconds"] for row in scores if row["duration_seconds"] is not None)
    evidence = {key: sum(row["evidence"][key] for row in scores)
                for key in ["total", "source_grounded", "label_supported", "page_referenced"]}
    for key in ["source_grounded", "label_supported", "page_referenced"]:
        evidence[key + "_rate"] = ratio(evidence[key], evidence["total"])
    environments = set()
    for row in scores:
        diagnostics = row["diagnostics"]
        if diagnostics.get("packages"):
            config = diagnostics.get("llm_config") or {}
            environment = {"packages": diagnostics["packages"],
                           "llm_config": {key: config.get(key) for key in ["model", "endpoint_host", "provider"]},
                           "llm_enabled": diagnostics.get("llm_enabled"),
                           "network_allowed": diagnostics.get("network_allowed")}
            environments.add(json.dumps(environment, sort_keys=True))
    return {
        "documents": len(scores), "completed": sum(row["status"] == "completed" for row in scores),
        "failed": sum(row["status"] == "failed" for row in scores),
        "timed_out": sum(row["status"] == "timeout" for row in scores),
        "skills": collection_metrics("skills"), "all_skills": collection_metrics("all_skills"),
        "employment": collection_metrics("employment"), "fields": fields, "evidence": evidence,
        "negative_skills": {key: sum(row["negative_skills"][key] for row in scores)
                            for key in ["total", "incorrectly_extracted"]},
        "catalog_missing": sorted({skill for row in scores for skill in row["catalog_missing"]}),
        "fallback_documents": sum(bool(row["diagnostics"].get("fallback_observed")) for row in scores),
        "model_response_documents": sum(bool(row["diagnostics"].get("llm_responses")) for row in scores),
        "runtime_environments": [json.loads(value) for value in sorted(environments)],
        "latency": {"samples": len(duration),
                    "median_seconds": statistics.median(duration) if duration else None,
                    "p95_seconds": duration[max(0, math.ceil(.95 * len(duration)) - 1)] if duration else None,
                    "scope": "isolated process wall time including imports; timeouts included"},
    }


def source_fingerprint() -> str:
    digest = hashlib.sha256()
    sources = sorted((ROOT / "src" / "ats_core").rglob("*.py")) + [Path(__file__).resolve()]
    for path in sources:
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def run_case(dataset: Path, row: dict, mode: str, as_of: str, network: bool) -> dict:
    """Child process adapter: observe the real parser; don't replace its extraction logic."""
    if not network:
        os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
        import socket

        def blocked(*args, **kwargs):
            raise OSError("Network disabled for offline extraction benchmark")
        socket.socket.connect = blocked
        socket.create_connection = blocked
        socket.getaddrinfo = blocked
    os.environ["ATS_FLYWHEEL_AUTO_REGISTER"] = "false"
    os.environ["LANGSMITH_TRACING"] = "false"
    sys.path.insert(0, str(ROOT / "src"))
    warnings = []

    class WarningCapture(logging.Handler):
        def emit(self, record):
            # Capture known pipeline events, never API keys or raw provider exception text.
            message = record.getMessage().casefold()
            for marker in ["fallback", "falling back", "sparse", "unavailable", "parsing failed"]:
                if marker in message:
                    warnings.append({"logger": record.name, "event": marker})
                    break
    handler = WarningCapture(level=logging.WARNING)
    logging.getLogger().addHandler(handler)
    from ats_core.parsers import resume_parser
    clock = datetime.fromisoformat(as_of)

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock.replace(tzinfo=tz) if tz else clock
    # Pin age/recency and Present calculations only in this disposable benchmark process.
    for name, module in list(sys.modules.items()):
        if name.startswith("ats_core.") and getattr(module, "datetime", None) is datetime:
            module.datetime = FixedDateTime
    engine = None
    original_extract = resume_parser.extract_text_from_document

    def traced_extract(*args, **kwargs):
        nonlocal engine
        text, engine, format_name = original_extract(*args, **kwargs)
        return text, engine, format_name
    resume_parser.extract_text_from_document = traced_extract
    model_trace = {"llm_attempts": 0, "llm_responses": 0}
    llm_config = None
    llm_enabled = mode == "configured" and os.getenv("ATS_AI_ENABLE_LLM", "true").lower() == "true"
    if llm_enabled:
        from ats_core.llm.client import get_llm_config
        from ats_core.parsers.llm_residue_extractor import LLMResidueExtractor
        config = get_llm_config()
        endpoint = urlsplit(config["base_url"])
        llm_config = {"model": config["model_name"], "endpoint_host": endpoint.hostname,
                      "provider": "openrouter" if config["is_openrouter"] else "ollama"}
        original_get = LLMResidueExtractor.get_instance

        class TracedChain:
            def __init__(self, chain):
                self.chain = chain

            def invoke(self, *args, **kwargs):
                model_trace["llm_attempts"] += 1
                response = self.chain.invoke(*args, **kwargs)
                model_trace["llm_responses"] += 1
                return response

        def traced_instance(cls):
            instance = original_get()
            if not isinstance(instance.chain, TracedChain):
                instance.chain = TracedChain(instance.chain)
            return instance
        LLMResidueExtractor.get_instance = classmethod(traced_instance)
    packages = {}
    for package in ["PyMuPDF", "docling", "spacy", "reportlab", "langchain-core"]:
        try:
            packages[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            packages[package] = None
    started = time.perf_counter()
    profile = resume_parser.parse_resume_to_candidate(
        local_path(dataset, row["pdf"]).read_bytes(), filename=Path(row["pdf"]).name,
        taxonomy_rows=read_json(dataset / "taxonomy.json"), allow_llm=llm_enabled)
    elapsed = time.perf_counter() - started
    raw = profile.get("raw_text", "")
    if len(raw.strip()) < 10:
        # Same empty-document rejection used by the private ingest worker.
        status, error_type = "failed", "DOCUMENT_TEXT_EMPTY"
    else:
        status, error_type = "completed", None
    gold = read_json(local_path(dataset, row["labels"]))
    evidence = [{"canonical_name": entity["canonical_name"], **mention}
                for entity in profile.get("enriched_skills", [])
                for mention in entity.get("evidence_mentions", [])]
    return {"status": status, "error_type": error_type, "parse_seconds": elapsed,
            "core_skills": profile.get("core_skills", []),
            "fields": {key: profile.get(key) for key in gold["fields"]},
            "experience": [{key: entry.get(key) for key in ["company", "role", "start_date", "end_date"]}
                           for entry in profile.get("experience", [])],
            "evidence": evidence, "raw_text": raw,
            "diagnostics": {"parser_engine": engine, "warnings": warnings,
                            "fallback_observed": any(w["event"] != "sparse" for w in warnings) or engine == "pymupdf_fallback",
                            "network_allowed": network, "llm_enabled": llm_enabled,
                            "llm_config": llm_config, "packages": packages, **model_trace}}


def percent(value) -> str:
    return f"{value:.1%}" if value is not None else "not defined"


def write_report(output: Path, summary: dict, scores: list[dict]) -> None:
    lines = ["# Resume extraction baseline", "", "Synthetic pilot; not production accuracy evidence.", "",
             f"Mode: **{summary['run']['mode']}**. Split: **{summary['run']['split']}**.",
             f"Reference date: {summary['run']['as_of']}.", "",
             "| Documents | Completed | Failed | Timed out | Fallback observed |",
             "|---:|---:|---:|---:|---:|",
             f"| {summary['documents']} | {summary['completed']} | {summary['failed']} | {summary['timed_out']} | {summary['fallback_documents']} |",
             "", "## Approved-catalog skill extraction", "",
             f"Precision: **{percent(summary['skills']['precision'])}**. "
             f"Recall: **{percent(summary['skills']['recall'])}**. F1: **{percent(summary['skills']['f1'])}**.",
             "", "Failures count as missed expected facts. Unknown catalog skills are reported separately.",
             "Catalog gaps: " + (", ".join(summary["catalog_missing"]) or "none") + ".", "",
             "| Category | Documents | Completed | Precision | Recall |",
             "|---|---:|---:|---:|---:|"]
    for category, metrics in summary["by_category"].items():
        lines.append(f"| {category} | {metrics['documents']} | {metrics['completed']} | "
                     f"{percent(metrics['skills']['precision'])} | {percent(metrics['skills']['recall'])} |")
    lines += ["", "## Fields and complete employment entries", "",
              "| Field | Correct / Total | Accuracy |", "|---|---:|---:|"]
    for field, counts in summary["fields"].items():
        lines.append(f"| {field} | {counts['correct']} / {counts['total']} | {percent(counts['accuracy'])} |")
    lines += ["", "Employment entry precision: " + percent(summary["employment"]["precision"]) +
              "; recall: " + percent(summary["employment"]["recall"]) + ".", "",
              "## Evidence", "", "Source-grounded mentions: " + percent(summary["evidence"]["source_grounded_rate"]) + ".",
              "Strict positive-gold-quote support: " + percent(summary["evidence"]["label_supported_rate"]) + ".",
              "Parser-supplied page reference coverage: " + percent(summary["evidence"]["page_referenced_rate"]) + ".",
              "Source containment alone does not establish positive skill evidence. Quote support is a strict proxy, not an entailment score.",
              "", "## Runtime and limitations", "",
              json.dumps(summary["latency"], indent=2), "",
              "Each case uses a new process; this includes dependency/model initialization and is not steady-state worker latency.",
              "Configured model responses observed: " + str(summary["model_response_documents"]) + " documents.",
              "This measures the parser used by ingest, not upload/queue/storage/database/end-to-end latency.",
              "Gold labels are fixture-author checked; independent recruiter annotation is pending.", "",
              "## Per-document errors", ""]
    for row in scores:
        kinds = Counter(error["kind"] for error in row["errors"])
        lines.append("- " + row["resume_id"] + " (" + row["status"] + "): " +
                     (", ".join(f"{key}: {count}" for key, count in sorted(kinds.items())) or "none"))
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "_case":
        dataset, identifier, mode, as_of, network, result_path = sys.argv[2:]
        row = next(row for row in [json.loads(line) for line in
                   (Path(dataset) / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
                   if row["resume_id"] == identifier)
        try:
            result = run_case(Path(dataset), row, mode, as_of, network == "yes")
        except Exception as exc:
            result = {"status": "failed", "error_type": type(exc).__name__,
                      "diagnostics": {"missing_dependency": getattr(exc, "name", None)}}
        write_json(Path(result_path), result)
        return 0
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--mode", choices=["rules", "configured"], default="rules")
    parser.add_argument("--split", choices=["dev", "test", "all"], default="dev")
    parser.add_argument("--case-timeout", type=float, default=90)
    parser.add_argument("--as-of", default="2026-10-10")
    parser.add_argument("--allow-model-network", action="store_true")
    parser.add_argument("--allow-private-data", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    datetime.fromisoformat(args.as_of)
    if args.case_timeout <= 0 or not math.isfinite(args.case_timeout):
        parser.error("--case-timeout must be finite and positive")
    if args.mode == "configured" and not args.allow_model_network:
        parser.error("configured extraction needs --allow-model-network")
    rows, taxonomy = validate_dataset(args.dataset.resolve())
    if args.validate_only:
        print(f"Validated {len(rows)} document hashes, gold labels and grouped splits")
        return 0
    rows = [row for row in rows if args.split == "all" or row["split"] == args.split]
    if not rows:
        parser.error("Selected split is empty")
    if any(row.get("contains_real_person_data") is not False for row in rows) and not args.allow_private_data:
        parser.error("real-person data requires --allow-private-data; reports contain extracted information")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = (args.output or args.dataset / "runs" / (args.mode + "-" + args.split + "-" + stamp)).resolve()
    output.mkdir(parents=True, exist_ok=False)
    metadata = {"mode": args.mode, "split": args.split, "as_of": args.as_of,
                "dataset_versions": sorted({row["dataset_version"] for row in rows}),
                "network_allowed": args.allow_model_network, "case_timeout_seconds": args.case_timeout,
                "python": sys.version.split()[0], "started_at": stamp,
                "source_sha256": source_fingerprint(),
                "manifest_sha256": sha256((args.dataset / "manifest.jsonl").read_bytes()),
                "taxonomy_sha256": sha256((args.dataset / "taxonomy.json").read_bytes()),
                "gold_sha256": {row["resume_id"]: sha256(local_path(args.dataset, row["labels"]).read_bytes()) for row in rows}}
    write_json(output / "run.json", metadata)
    scores = []
    with (output / "predictions.jsonl").open("w", encoding="utf-8") as predictions:
        for row in rows:
            result_path = output / (".case-" + row["resume_id"] + ".json")
            started = time.perf_counter()
            try:
                completed = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), "_case", str(args.dataset.resolve()),
                     row["resume_id"], args.mode, args.as_of, "yes" if args.allow_model_network else "no", str(result_path)],
                    timeout=args.case_timeout, capture_output=True, text=True, errors="replace")
                if completed.returncode or not result_path.exists():
                    prediction = {"status": "failed", "error_type": "CHILD_PROCESS_FAILED"}
                else:
                    prediction = read_json(result_path)
            except subprocess.TimeoutExpired:
                prediction = {"status": "timeout", "error_type": "CASE_TIMEOUT"}
            prediction.update(resume_id=row["resume_id"], duration_seconds=time.perf_counter() - started)
            predictions.write(json.dumps(prediction, ensure_ascii=False, allow_nan=False) + "\n")
            predictions.flush()
            if result_path.exists():
                result_path.unlink()
            gold = read_json(local_path(args.dataset, row["labels"]))
            scores.append(score_case(row, gold, prediction, taxonomy))
            print(f"{row['resume_id']}: {prediction['status']} ({prediction['duration_seconds']:.2f}s)", flush=True)
    summary = summarize(scores)
    summary["run"] = metadata
    summary["by_category"] = {category: summarize([row for row in scores if row["category"] == category])
                              for category in sorted({row["category"] for row in scores})}
    summary["by_split"] = {split: summarize([row for row in scores if row["split"] == split])
                           for split in sorted({row["split"] for row in scores})}
    write_json(output / "summary.json", summary)
    write_json(output / "scores.json", scores)
    with (output / "errors.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["resume_id", "category", "split", "kind", "expected", "actual"])
        writer.writeheader()
        for row in scores:
            for error in row["errors"]:
                writer.writerow({"resume_id": row["resume_id"], "category": row["category"], "split": row["split"],
                                 **{key: json.dumps(error[key], ensure_ascii=False) for key in ["kind", "expected", "actual"]}})
    write_report(output, summary, scores)
    print("Report: " + str(output / "report.md"))
    # Accuracy defects are benchmark findings; incomplete processing is a failing run.
    return 2 if summary["failed"] or summary["timed_out"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
