from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.evaluator.llm_evaluator import (
    LLMEvaluator,
    EvaluationReport,
    CriteriaScore,
    evaluate_candidate,
)
from ats_core.evaluator.langsmith_tracker import (
    is_langsmith_enabled,
    get_langsmith_config,
    get_langsmith_client,
    get_langsmith_project,
    build_evaluation_run_config,
    log_evaluation_feedback,
    compute_citation_validity,
    get_run_url,
)

from ats_core.evaluator.benchmark_langsmith import (
    run_candidate_benchmark,
    sync_langsmith_benchmark_dataset,
    evaluate_tier_accuracy,
    evaluate_score_calibration,
    evaluate_citation_grounding,
    evaluate_injection_defense,
    BENCHMARK_EXAMPLES,
    BENCHMARK_JOB,
)

__all__ = [
    "LocalDeepEvaluator",
    "AuditLogger",
    "LLMEvaluator",
    "EvaluationReport",
    "CriteriaScore",
    "evaluate_candidate",
    "is_langsmith_enabled",
    "get_langsmith_config",
    "get_langsmith_client",
    "get_langsmith_project",
    "build_evaluation_run_config",
    "log_evaluation_feedback",
    "compute_citation_validity",
    "get_run_url",
    "run_candidate_benchmark",
    "sync_langsmith_benchmark_dataset",
    "evaluate_tier_accuracy",
    "evaluate_score_calibration",
    "evaluate_citation_grounding",
    "evaluate_injection_defense",
    "BENCHMARK_EXAMPLES",
    "BENCHMARK_JOB",
]


def __getattr__(name):
    # Private AI imports must not initialize the legacy database adapter.
    if name == "AuditLogger":
        from ats_core.evaluator.audit_logger import AuditLogger

        return AuditLogger
    raise AttributeError(name)


