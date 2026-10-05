import logging
import uuid
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from ats_core.models.db import ScoringAudit
from ats_core.models.id_utils import coerce_to_uuid, optional_coerce_to_uuid
from ats_core.schema.evaluation import DeepCandidateEvaluationReport

logger = logging.getLogger("ats.evaluator.audit")

# Live in-memory audit registry for EEOC and compliance audits across services
AUDIT_LOG_STORE: List[ScoringAudit] = []


class AuditLogger:
    """Persists structured evaluation scorecards and telemetry to PostgreSQL scoring_audits."""

    @staticmethod
    async def persist_audit_record(
        session: Optional[AsyncSession],
        report: DeepCandidateEvaluationReport,
        candidate_id: str,
        job_id: str,
        application_id: Optional[str] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        raw_prompt: str = "",
    ) -> ScoringAudit:
        """Saves an immutable evaluation record to PostgreSQL or live audit store."""
        if telemetry is None:
            telemetry = {}

        if not candidate_id or not str(candidate_id).strip():
            raise ValueError("Candidate and job IDs are required to persist an audit")
        if not job_id or not str(job_id).strip():
            raise ValueError("Candidate and job IDs are required to persist an audit")

        # Coerce candidate and job IDs safely into valid UUIDs (supports cand-<hex>, job-001, etc.)
        c_uuid = coerce_to_uuid(candidate_id)
        j_uuid = coerce_to_uuid(job_id)
        app_uuid = optional_coerce_to_uuid(application_id)

        tier_val = (
            report.qualification_tier.value
            if hasattr(report.qualification_tier, "value")
            else str(getattr(report, "qualification_tier", None) or "Potential Fit")
        )

        criteria = []
        for c in (getattr(report, "criteria_breakdown", []) or []):
            if hasattr(c, "model_dump"):
                criteria.append(c.model_dump())
            elif isinstance(c, dict):
                criteria.append(c)
            else:
                criteria.append({"raw": str(c)})

        pros = list(getattr(report, "key_strengths", []) or [])
        cons = list(getattr(report, "risks_and_skill_gaps", []) or [])
        questions = [
            q.question if hasattr(q, "question") else str(q)
            for q in (getattr(report, "suggested_interview_questions", []) or [])
        ]
        recruiter_summary = getattr(report, "executive_verdict", "") or "Candidate evaluation audit."

        audit_entry = ScoringAudit(
            id=uuid.uuid4(),
            application_id=app_uuid,
            candidate_id=c_uuid,
            job_id=j_uuid,
            overall_match_score=float(getattr(report, "overall_match_score", 0.0)),
            qualification_tier=tier_val,
            criteria_breakdown=criteria,
            pros=pros,
            cons_or_risks=cons,
            recommended_interview_questions=questions,
            recruiter_summary=recruiter_summary,
            llm_model=telemetry.get("model", "gemma4:e2b"),
            latency_ms=telemetry.get("latency_ms", 0),
            raw_prompt=raw_prompt,
        )

        AUDIT_LOG_STORE.append(audit_entry)

        if session is not None:
            session.add(audit_entry)
            await session.commit()

        logger.info(f"Audit record persisted for candidate={candidate_id} ({c_uuid}) job={job_id} ({j_uuid})")
        return audit_entry

    @classmethod
    def get_audits(cls, candidate_id: Optional[str] = None, job_id: Optional[str] = None) -> List[ScoringAudit]:
        """Retrieve stored in-memory audit records, optionally filtered by candidate or job."""
        c_uuid = optional_coerce_to_uuid(candidate_id) if candidate_id else None
        j_uuid = optional_coerce_to_uuid(job_id) if job_id else None
        results = []
        for a in AUDIT_LOG_STORE:
            if c_uuid and a.candidate_id != c_uuid:
                continue
            if j_uuid and a.job_id != j_uuid:
                continue
            results.append(a)
        return results

    @classmethod
    def clear_audits(cls) -> None:
        """Clear the in-memory audit store (useful for test isolation)."""
        AUDIT_LOG_STORE.clear()
