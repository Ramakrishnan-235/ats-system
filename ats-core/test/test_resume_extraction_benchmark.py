"""Behavioral tests for extraction evaluation, corpus integrity and hard deadlines."""
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "resume_benchmark", ROOT / "scripts" / "benchmark_resume_extraction.py")
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.row = {"resume_id": "fixture", "category": "negation", "split": "dev", "page_count": 1}
        self.taxonomy = [{"canonical_name": name, "status": "approved"}
                         for name in ["Python", "Docker", "Kubernetes"]]
        self.gold = {
            "skills": [{"canonical_name": "Python", "quote": "Built APIs using Python.", "page": 1},
                       {"canonical_name": "Docker", "quote": "Deployed using Docker.", "page": 1}],
            "negative_skills": [{"canonical_name": "Kubernetes", "quote": "No Kubernetes experience.", "page": 1}],
            "fields": {"email": "test@example.invalid", "phone": None},
            "employment": [{"company": "Example Lab", "role": "Developer",
                            "start_date": "2023-01", "end_date": "2024-12"}],
        }
        self.prediction = {
            "status": "completed", "core_skills": ["Python", "Kubernetes"],
            "fields": {"email": "test@example.invalid", "phone": "N/A"},
            "experience": [], "duration_seconds": 1.0, "diagnostics": {},
            "raw_text": "Built APIs using Python. No Kubernetes experience.",
            "evidence": [
                {"canonical_name": "Python", "sentence": "Built APIs using Python."},
                {"canonical_name": "Kubernetes", "sentence": "No Kubernetes experience."},
                {"canonical_name": "Docker", "sentence": "Invented deployment using Docker."},
            ],
        }

    def score(self):
        return benchmark.score_case(self.row, self.gold, self.prediction, self.taxonomy)

    def test_missed_and_unsupported_skills_are_both_penalized(self):
        score = self.score()
        self.assertEqual((score["skills"]["tp"], score["skills"]["fp"], score["skills"]["fn"]), (1, 1, 1))
        self.assertEqual(score["skills"]["precision"], .5)
        self.assertEqual(score["skills"]["recall"], .5)
        self.assertEqual(score["negative_skills"]["incorrectly_extracted"], 1)

    def test_failed_documents_cannot_receive_credit_for_default_missing_fields(self):
        self.prediction["status"] = "failed"
        score = self.score()
        self.assertEqual(score["skills"]["fn"], 2)
        self.assertEqual(score["fields"]["phone"]["correct"], 0)
        self.assertEqual(score["employment"]["fn"], 1)
        self.assertEqual(score["evidence"]["total"], 0)

    def test_unknown_catalog_skill_is_separate_from_parser_recall(self):
        self.gold["skills"].append({"canonical_name": "UnknownTool", "quote": "Used UnknownTool.", "page": 1})
        score = self.score()
        self.assertEqual(score["catalog_missing"], ["unknowntool"])
        self.assertEqual(score["skills"]["fn"], 1)
        self.assertEqual(score["all_skills"]["fn"], 2)

    def test_evidence_containment_does_not_credit_negation_or_invented_quotes(self):
        evidence = self.score()["evidence"]
        self.assertEqual(evidence["total"], 3)
        self.assertEqual(evidence["source_grounded"], 2)
        self.assertEqual(evidence["label_supported"], 1)
        self.assertEqual(evidence["page_referenced"], 0)

    def test_employment_dates_must_belong_to_the_correct_employer(self):
        self.prediction["experience"] = [{"company": "Other Lab", "role": "Developer",
                                          "start_date": "2023-01-01", "end_date": "2024-12-01"}]
        self.assertEqual(self.score()["employment"], {"tp": 0, "fp": 1, "fn": 1})

    def test_duplicate_employment_is_not_hidden_by_set_matching(self):
        self.prediction["experience"] = self.gold["employment"] * 2
        self.assertEqual(self.score()["employment"], {"tp": 1, "fp": 1, "fn": 0})

    def test_empty_denominators_are_undefined(self):
        metrics = benchmark.set_metrics(set(), set())
        self.assertIsNone(metrics["precision"])
        self.assertIsNone(metrics["recall"])
        self.assertIsNone(metrics["f1"])

    def test_summary_keeps_failures_and_timeout_durations(self):
        completed = self.score()
        self.prediction = {"status": "timeout", "duration_seconds": 5}
        timed_out = self.score()
        summary = benchmark.summarize([completed, timed_out])
        self.assertEqual(summary["timed_out"], 1)
        self.assertEqual(summary["skills"]["fn"], 3)
        self.assertEqual(summary["latency"]["p95_seconds"], 5)
        self.assertEqual(summary["latency"]["median_seconds"], 3)

    def test_runtime_metadata_records_model_without_credentials(self):
        self.prediction["diagnostics"] = {
            "packages": {"PyMuPDF": "1.27"}, "llm_enabled": True, "network_allowed": True,
            "llm_config": {"model": "local-model", "endpoint_host": "localhost",
                           "provider": "ollama", "api_key": "must-not-appear"},
            "api_key": "must-not-appear",
        }
        summary = benchmark.summarize([self.score()])
        self.assertEqual(summary["runtime_environments"][0]["llm_config"]["model"], "local-model")
        self.assertNotIn("must-not-appear", json.dumps(summary))

    def dataset_copy(self, directory):
        dataset = Path(directory) / "dataset"
        shutil.copytree(benchmark.DEFAULT_DATASET, dataset, ignore=shutil.ignore_patterns("runs", "private"))
        return dataset

    def test_published_corpus_and_grouped_splits_validate(self):
        rows, taxonomy = benchmark.validate_dataset(benchmark.DEFAULT_DATASET)
        self.assertEqual(len(rows), 10)
        self.assertGreater(len(taxonomy), 10)

    def test_hash_tampering_and_group_leakage_are_rejected(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(ROOT.resolve()))
            dataset = self.dataset_copy(directory)
            manifest_path = dataset / "manifest.jsonl"
            rows = [json.loads(line) for line in manifest_path.read_text().splitlines()]
            rows[4]["split"] = "test"  # Scanned backend version must stay with its dev original.
            manifest_path.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "leaks"):
                benchmark.validate_dataset(dataset)
            rows[4]["split"] = "dev"
            manifest_path.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            (dataset / rows[0]["pdf"]).write_bytes(b"%PDF-tampered")
            with self.assertRaisesRegex(ValueError, "hash"):
                benchmark.validate_dataset(dataset)

    def test_path_escape_is_rejected(self):
        with self.assertRaises(ValueError):
            benchmark.local_path(benchmark.DEFAULT_DATASET, "../outside.pdf")

    def test_bad_gold_page_and_misattributed_quote_are_rejected(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(ROOT.resolve()))
            dataset = self.dataset_copy(directory)
            label_path = dataset / "labels" / "synthetic-001.json"
            gold = benchmark.read_json(label_path)
            gold["skills"][0]["page"] = 2
            benchmark.write_json(label_path, gold)
            with self.assertRaisesRegex(ValueError, "valid page"):
                benchmark.validate_dataset(dataset)
            gold["skills"][0]["page"] = 1
            gold["skills"][0]["quote"] = "No such sentence in the PDF."
            benchmark.write_json(label_path, gold)
            with self.assertRaisesRegex(ValueError, "annotated PDF page"):
                benchmark.validate_dataset(dataset)

    def test_consent_provenance_is_required(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(ROOT.resolve()))
            dataset = self.dataset_copy(directory)
            path = dataset / "manifest.jsonl"
            rows = [json.loads(line) for line in path.read_text().splitlines()]
            rows[0]["permission"] = "public_url"
            path.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "provenance"):
                benchmark.validate_dataset(dataset)

    def test_cli_enforces_real_subprocess_deadlines_and_writes_partial_report(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(ROOT.resolve()))
            sleeper = Path(directory) / "sleeper.py"
            sleeper.write_text("import time\ntime.sleep(10)\n", encoding="utf-8")
            output = Path(directory) / "run"
            args = ["benchmark", "--split", "dev", "--case-timeout", "0.1", "--output", str(output)]
            with patch.object(benchmark, "__file__", str(sleeper)), patch.object(sys, "argv", args):
                self.assertEqual(benchmark.main(), 2)
            summary = benchmark.read_json(output / "summary.json")
            self.assertEqual(summary["documents"], 5)
            self.assertEqual(summary["timed_out"], 5)
            self.assertEqual(summary["completed"], 0)
            self.assertTrue((output / "report.md").is_file())
            self.assertEqual(len((output / "predictions.jsonl").read_text().splitlines()), 5)


if __name__ == "__main__":
    unittest.main()
