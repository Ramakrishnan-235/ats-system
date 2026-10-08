"""
langsmith_tracker.py
Centralized LangSmith Observability, Performance Telemetry, and Evaluation Feedback.

Provides:
1. Dynamic detection of LangSmith tracing configuration.
2. Thread-safe client initialization with cached singleton pattern.
3. RunnableConfig generation with structured tags and metadata for searchable tracing.
4. Model performance tracking via LangSmith Feedback API:
   - overall_match_score (0.0 - 100.0)
   - latency_ms
   - qualification_tier (Strong Fit / Potential Fit / Low Match)
   - citation_validity_rate (anti-hallucination verification)
   - criteria_count
   - evaluation_success (1.0 or 0.0)
5. Deep-link generation to inspect individual run traces in the LangSmith UI.
6. Fail-safe, non-blocking design: evaluations are never interrupted if LangSmith is disabled or unreachable.
"""

import logging
import os
import threading
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("ats.evaluator.langsmith")

_client_instance: Optional[Any] = None
_client_lock = threading.Lock()
_client_init_failed = False


def get_langsmith_config() -> Dict[str, Any]:
    """
    Resolves LangSmith environment configuration.
    Supports standard LangChain / LangSmith environment variables.
    """
    tracing_env = (
        os.getenv("LANGCHAIN_TRACING_V2", "")
        or os.getenv("LANGSMITH_TRACING", "")
        or ""
    ).strip().lower()
    tracing_enabled = tracing_env in ("true", "1", "yes", "on")

    api_key = (
        os.getenv("LANGCHAIN_API_KEY", "")
        or os.getenv("LANGSMITH_API_KEY", "")
        or ""
    ).strip()

    project = (
        os.getenv("LANGCHAIN_PROJECT", "")
        or os.getenv("LANGSMITH_PROJECT", "")
        or "ats-candidate-evaluator"
    ).strip()

    endpoint = (
        os.getenv("LANGCHAIN_ENDPOINT", "")
        or os.getenv("LANGSMITH_ENDPOINT", "")
        or "https://api.smith.langchain.com"
    ).strip()

    is_enabled = tracing_enabled and bool(api_key)

    return {
        "tracing_enabled": tracing_enabled,
        "api_key": api_key,
        "project": project,
        "endpoint": endpoint,
        "is_enabled": is_enabled,
    }


def is_langsmith_enabled() -> bool:
    """Returns True if LangSmith tracing is active and an API key is present."""
    return get_langsmith_config()["is_enabled"]


def get_langsmith_project() -> str:
    """Returns the configured LangSmith project name."""
    return get_langsmith_config()["project"]


def get_langsmith_client() -> Optional[Any]:
    """
    Thread-safe cached singleton for the LangSmith Client.
    Returns None if LangSmith is disabled, unconfigured, or fails to initialize.
    """
    global _client_instance, _client_init_failed

    if not is_langsmith_enabled():
        return None

    if _client_instance is not None:
        return _client_instance

    if _client_init_failed:
        return None

    with _client_lock:
        if _client_instance is not None:
            return _client_instance
        try:
            from langsmith import Client

            cfg = get_langsmith_config()
            _client_instance = Client(
                api_key=cfg["api_key"],
                api_url=cfg["endpoint"],
            )
            logger.info("LangSmith client initialized successfully for project: %s", cfg["project"])
            return _client_instance
        except Exception as e:
            _client_init_failed = True
            logger.warning("Could not initialize LangSmith client: %s", e)
            return None


def reset_langsmith_client() -> None:
    """Resets cached client instance (primarily used for test isolation)."""
    global _client_instance, _client_init_failed
    with _client_lock:
        _client_instance = None
        _client_init_failed = False


def build_evaluation_run_config(
    candidate_id: str,
    job_title: str,
    model_name: str,
    evaluator_type: str = "deep_evaluator",
    extra_tags: Optional[List[str]] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Builds a LangChain RunnableConfig dictionary containing standardized run name,
    tags, and metadata for tracking in LangSmith.
    """
    sanitized_job = (job_title or "General").strip().replace("\n", " ")[:40]
    run_name = f"{evaluator_type}:{sanitized_job}"

    tags: List[str] = [
        "ats-system",
        evaluator_type,
        model_name,
    ]
    if extra_tags:
        tags.extend([t for t in extra_tags if t and t not in tags])

    metadata: Dict[str, Any] = {
        "candidate_id": str(candidate_id),
        "job_title": str(job_title),
        "model_name": str(model_name),
        "evaluator_type": str(evaluator_type),
        "ats_environment": os.getenv("ATS_ENV", "production"),
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    return {
        "run_name": run_name,
        "tags": tags,
        "metadata": metadata,
    }


def get_run_url(run_id: str, project_name: Optional[str] = None) -> str:
    """Constructs a direct URL to inspect the run trace in the LangSmith web UI."""
    project = project_name or get_langsmith_project()
    return f"https://smith.langchain.com/o/default/projects/p/{project}/r/{run_id}"


def log_evaluation_feedback(
    run_id: Optional[str],
    metrics: Dict[str, Any],
    tags: Optional[List[str]] = None,
    comment: Optional[str] = None,
) -> bool:
    """
    Records performance evaluation metrics and feedback for a specific LangSmith run.
    
    Numeric metrics (e.g. overall_match_score, latency_ms, citation_validity_rate)
    are logged with `score`. String/categorical metrics (e.g. qualification_tier)
    are logged with `value`.
    
    Never raises exceptions — gracefully logs errors to debug.
    Returns True if feedback was successfully sent, False otherwise.
    """
    if not run_id or not is_langsmith_enabled():
        return False

    client = get_langsmith_client()
    if client is None:
        return False

    success = True
    for key, val in metrics.items():
        if val is None:
            continue
        try:
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                client.create_feedback(
                    run_id=run_id,
                    key=key,
                    score=float(val),
                    comment=comment,
                )
            elif isinstance(val, bool):
                client.create_feedback(
                    run_id=run_id,
                    key=key,
                    score=1.0 if val else 0.0,
                    comment=comment,
                )
            else:
                client.create_feedback(
                    run_id=run_id,
                    key=key,
                    value=str(val),
                    comment=comment,
                )
        except Exception as e:
            success = False
            logger.debug("Failed to record LangSmith feedback '%s': %s", key, e)

    return success


def compute_citation_validity(
    criteria_breakdown: List[Any],
    source_text: str,
) -> Dict[str, Any]:
    """
    Evaluates anti-hallucination citation adherence:
    Checks how many citations produced by the model are genuinely present
    in the candidate resume text.
    """
    cleaned_source = " ".join(source_text.split()).lower() if source_text else ""
    total_citations = 0
    grounded_citations = 0

    for crit in criteria_breakdown:
        citation = getattr(crit, "verbatim_citation", None)
        if citation is None and isinstance(crit, dict):
            citation = crit.get("verbatim_citation")

        if citation and str(citation).strip():
            total_citations += 1
            cleaned_citation = " ".join(str(citation).split()).lower()
            if cleaned_citation in cleaned_source:
                grounded_citations += 1

    validity_rate = (
        grounded_citations / total_citations if total_citations > 0 else 1.0
    )

    return {
        "total_citations": total_citations,
        "grounded_citations": grounded_citations,
        "citation_validity_rate": round(validity_rate, 3),
    }
