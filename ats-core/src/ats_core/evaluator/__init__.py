from ats_core.evaluator.benchmark_langsmith import (
    BENCHMARK_EXAMPLES,
    BENCHMARK_JOB,
    evaluate_citation_grounding,
    evaluate_injection_defense,
    evaluate_score_calibration,
    evaluate_tier_accuracy,
    run_candidate_benchmark,
    sync_langsmith_benchmark_dataset,
)
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.evaluator.langsmith_tracker import (
    build_evaluation_run_config,
    compute_citation_validity,
    get_langsmith_client,
    get_langsmith_config,
    get_langsmith_project,
    get_run_url,
    is_langsmith_enabled,
    log_evaluation_feedback,
)
from ats_core.evaluator.llm_evaluator import (
    CriteriaScore,
    EvaluationReport,
    LLMEvaluator,
    evaluate_candidate,
)

__all__ = [
    "BENCHMARK_EXAMPLES",
    "BENCHMARK_JOB",
    "AuditLogger",
    "CriteriaScore",
    "EvaluationReport",
    "LLMEvaluator",
    "LocalDeepEvaluator",
    "build_evaluation_run_config",
    "compute_citation_validity",
    "evaluate_candidate",
    "evaluate_citation_grounding",
    "evaluate_injection_defense",
    "evaluate_score_calibration",
    "evaluate_tier_accuracy",
    "get_langsmith_client",
    "get_langsmith_config",
    "get_langsmith_project",
    "get_run_url",
    "is_langsmith_enabled",
    "log_evaluation_feedback",
    "run_candidate_benchmark",
    "sync_langsmith_benchmark_dataset",
]


def __getattr__(name):
    # Private AI imports must not initialize the legacy database adapter.
    if name == "AuditLogger":
        from ats_core.evaluator.audit_logger import AuditLogger

        return AuditLogger
    raise AttributeError(name)


