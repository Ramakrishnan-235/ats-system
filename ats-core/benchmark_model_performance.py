"""
benchmark_model_performance.py
CLI Tool for Benchmarking LLM Performance and Tracking via LangSmith.

Usage:
    uv run python benchmark_model_performance.py
    uv run python benchmark_model_performance.py --model gemma4:e2b --target-latency 2.5
    uv run python benchmark_model_performance.py --model nvidia/nemotron-3.5-lightning:free
    uv run python benchmark_model_performance.py --sync-dataset

Tracks:
- Tier Categorization Accuracy (Strong Fit, Potential Fit, Low Match)
- Score Calibration Adherence (Calibration within rubric bounds)
- Anti-Hallucination Citation Grounding (Fidelity against source text)
- Adversarial Prompt Injection Defense (Defanging malicious directives)
- P50 & P95 Inference Latency (SLA verification)
- Live LangSmith Trace & Feedback Recording (When LANGCHAIN_API_KEY is configured)
"""

import argparse
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Reconfigure stdout for UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")

# Load environment configuration
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

# Ensure src is on sys.path
src_dir = str(Path(__file__).resolve().parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.evaluator.langsmith_tracker import is_langsmith_enabled, get_langsmith_config
from ats_core.evaluator.benchmark_langsmith import (
    run_candidate_benchmark,
    sync_langsmith_benchmark_dataset,
)


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark ATS LLM Model Performance with LangSmith Tracing & Telemetry"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model identifier to evaluate (e.g., 'gemma4:e2b', 'nvidia/nemotron-3.5-lightning:free'). Defaults to LLM_MODEL in .env.",
    )
    parser.add_argument(
        "--target-latency",
        type=float,
        default=3.0,
        help="Latency threshold in seconds (default: 3.0s)",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default="ats-candidate-benchmark-v1",
        help="LangSmith benchmark dataset name (default: 'ats-candidate-benchmark-v1')",
    )
    parser.add_argument(
        "--sync-dataset",
        action="store_true",
        help="Upload / sync the standardized benchmark dataset to LangSmith.",
    )
    args = parser.parse_args()

    cfg = get_langsmith_config()
    if is_langsmith_enabled():
        print(f"[INFO] LangSmith Tracing: ENABLED | Project: '{cfg['project']}' | Endpoint: '{cfg['endpoint']}'")
    else:
        print("[INFO] LangSmith Tracing: OFFLINE / UNCONFIGURED (Set LANGCHAIN_API_KEY in .env to stream traces to LangSmith)")

    if args.sync_dataset:
        print(f"\n[INFO] Synchronizing benchmark dataset '{args.dataset}' to LangSmith...")
        ds = sync_langsmith_benchmark_dataset(dataset_name=args.dataset)
        if ds:
            print(f"[SUCCESS] Dataset synchronized: {ds.name} (ID: {ds.id})")
        else:
            print("[NOTICE] Dataset synchronization requires active LANGCHAIN_API_KEY.")
        if not args.model:
            return

    evaluator = LocalDeepEvaluator(
        model_name=args.model,
        temperature=0.1,
    )

    results = run_candidate_benchmark(
        evaluator=evaluator,
        target_latency_seconds=args.target_latency,
        dataset_name=args.dataset,
        model_name=args.model,
    )

    if not results.get("passed", False):
        sys.exit(1)


if __name__ == "__main__":
    main()
