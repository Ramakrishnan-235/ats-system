import json
import logging
import sys
from pathlib import Path

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator
from ats_core.schema.evaluation import (
    DeepCandidateEvaluationReport,
    QualificationTier,
    CriterionScore,
    CriterionCategory,
    SuggestedInterviewQuestion,
    QuestionCategory,
)


def test_deep_evaluator_schema_contracts():
    # 1. Test Schema validation
    report = DeepCandidateEvaluationReport(
        candidate_id="cand-88319-arch",
        job_title="Senior Distributed Systems & Storage Engineer",
        overall_match_score=94.0,
        qualification_tier=QualificationTier.STRONG_FIT,
        executive_verdict="Senior systems architect with deep Raft consensus and RocksDB storage engine expertise.",
        criteria_breakdown=[
            CriterionScore(
                category=CriterionCategory.TECH_STACK_ALIGNMENT,
                score=5,
                weight=1.5,
                assessment="Demonstrated mastery of Rust, C++, and Go.",
                verbatim_citation="Architected a distributed write-ahead log (WAL) utilizing the Raft consensus protocol in Rust",
            )
        ],
        key_strengths=[
            "Architected write-ahead log using Raft protocol in Rust.",
            "Tuned RocksDB to 1.8M IOPS.",
        ],
        risks_and_skill_gaps=[],
        suggested_interview_questions=[
            SuggestedInterviewQuestion(
                category=QuestionCategory.ARCHITECTURE_SYSTEM_DESIGN,
                question="How did you handle log compaction and snapshotting in Raft?",
                target_competency="Distributed Consensus",
                expected_positive_signal="Details log truncation and snapshot state machine handling.",
            )
        ],
    )

    assert report.candidate_id == "cand-88319-arch"
    assert report.qualification_tier == QualificationTier.STRONG_FIT
    assert len(report.criteria_breakdown) == 1
    assert report.criteria_breakdown[0].score == 5
    assert len(report.suggested_interview_questions) == 1
    print("✓ DeepCandidateEvaluationReport schema contract test passed.")


def test_local_deep_evaluator_instantiation():
    evaluator = LocalDeepEvaluator(
        base_url="http://localhost:11434/v1",
        model_name="gemma4:e2b",
        temperature=0.1,
    )
    assert evaluator.model_name == "gemma4:e2b"
    assert evaluator.temperature == 0.1
    print("✓ LocalDeepEvaluator instantiation test passed.")


if __name__ == "__main__":
    test_deep_evaluator_schema_contracts()
    test_local_deep_evaluator_instantiation()
