import sys
from pathlib import Path

# Add src and root to sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from benchmark_evaluation_latency import run_benchmark


def test_llm_evaluation_latency_and_rate_limits():
    """Verify that candidate evaluations complete under 3s threshold without rate-limit drops."""
    results = run_benchmark(target_latency_seconds=3.0, model_name="gemma4:e2b")
    assert results["passed"] is True, "LLM evaluation benchmark must pass"
    assert results["mean_latency_sec"] < 3.0, "Mean latency must be under 3.0 seconds"
    assert results["rate_limit_drops"] == 0, "Rate-limit drops must be 0"
    assert results["success_rate"] == 1.0, "Success rate must be 100%"
