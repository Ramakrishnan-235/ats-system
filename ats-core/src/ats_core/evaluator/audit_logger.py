import uuid
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from ats_core.models.db import ScoringAudit
from ats_core.schema.evaluation import DeepCandidateEvaluationReport


class AuditLogger:
    """Persists structured evaluation scorecards and telemetry to PostgreSQL scoring_audits."""

    @staticmethod
    async def persist_audit_record(
        session: AsyncSession,
        report: DeepCandidateEvaluationReport,
        candidate_id: str,
        job_id: str,
        application_id: Optional[str] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        raw_prompt: str = "",
    ) -> ScoringAudit:
        """Saves an immutable evaluation record to PostgreSQL."""
        if telemetry is None:
            telemetry = {}

        # Safely extract UUIDs
        def parse_uuid(val: Optional[str]) -> Optional[uuid.UUID]:
            if not val:
                return None
            try:
                return uuid.UUID(str(val))
            except (ValueError, AttributeError):
                return uuid.uuid5(uuid.NAMESPACE_DNS, str(val))

        c_uuid = parse_uuid(candidate_id) or uuid.uuid4()
        j_uuid = parse_uuid(job_id) or uuid.uuid4()
        app_uuid = parse_uuid(application_id)

        tier_val = (
            report.qualification_tier.value
            if hasattr(report.qualification_tier, "value")
            else str(report.qualification_tier)
        )

        audit_entry = ScoringAudit(
            id=uuid.uuid4(),
            application_id=app_uuid,
            candidate_id=c_uuid,
            job_id=j_uuid,
            overall_match_score=float(report.overall_match_score),
            qualification_tier=tier_val,
            criteria_breakdown=[c.model_dump() for c in report.criteria_breakdown],
            pros=list(report.key_strengths),
            cons_or_risks=list(report.risks_and_skill_gaps),
            recommended_interview_questions=[q.question for q in report.suggested_interview_questions],
            recruiter_summary=report.executive_verdict,
            llm_model=telemetry.get("model", "gemma4:e2b"),
            latency_ms=telemetry.get("latency_ms", 0),
            raw_prompt=raw_prompt,
        )

        session.add(audit_entry)
        await session.commit()
        return audit_entry
