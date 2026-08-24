from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/match", tags=["Candidate Matching"])

_retriever = None
_reranker = None


def get_retriever():
    global _retriever
    if _retriever is None:
        from ats_core.search.hybrid_retriever import HybridCandidateRetriever
        _retriever = HybridCandidateRetriever()
    return _retriever


def get_reranker():
    global _reranker
    if _reranker is None:
        from ats_core.search.reranker import CandidateReranker
        _reranker = CandidateReranker(model_name="BAAI/bge-reranker-large")
    return _reranker


class MatchRequest(BaseModel):
    job_title: str
    job_description: str
    stage1_retrieve_limit: int = Field(default=100, description="Number of candidates from hybrid search")
    stage2_rerank_limit: int = Field(default=20, description="Candidates sent to deep LLM evaluation")


class MatchResponse(BaseModel):
    job_title: str
    total_retrieved_stage1: int
    total_reranked_stage2: int
    final_evaluations: List[Dict[str, Any]]


@router.post("/evaluate-job", response_model=MatchResponse)
async def match_and_evaluate_candidates(request: MatchRequest):
    query_text = f"Title: {request.job_title}\nRequirements: {request.job_description}"

    try:
        retriever = get_retriever()
        stage1_candidates = retriever.hybrid_search(
            query=query_text,
            top_k=request.stage1_retrieve_limit
        )
    except Exception as e:
        stage1_candidates = []

    if not stage1_candidates:
        return MatchResponse(
            job_title=request.job_title,
            total_retrieved_stage1=0,
            total_reranked_stage2=0,
            final_evaluations=[]
        )

    # -------------------------------------------------------------------------
    # STAGE 2: Cross-Encoder Re-Ranking -> Top 20
    # -------------------------------------------------------------------------
    try:
        reranker = get_reranker()
        stage2_candidates = reranker.rerank(
            query=query_text,
            candidates=stage1_candidates,
            top_k=request.stage2_rerank_limit
        )
    except Exception as e:
        stage2_candidates = stage1_candidates[:request.stage2_rerank_limit]

    # -------------------------------------------------------------------------
    # STAGE 3: Deep LLM Evaluation (Top 20 only)
    # -------------------------------------------------------------------------
    from ats_core.evaluator.llm_evaluator import evaluate_candidate, EvaluationReport
    final_results = []
    for cand in stage2_candidates:
        try:
            report: EvaluationReport = evaluate_candidate(
                candidate_summary=cand.get("text", cand.get("summary_text", "")),
                job_description=request.job_description
            )
            final_results.append({
                "candidate_id": cand["candidate_id"],
                "rerank_score": cand.get("rerank_score", 0.95),
                "rerank_rank": cand.get("rerank_rank", 1),
                "evaluation": report.model_dump()
            })
        except Exception:
            pass

    # Sort final output by LLM overall match score
    final_results.sort(key=lambda x: x["evaluation"]["match_score"], reverse=True)

    return MatchResponse(
        job_title=request.job_title,
        total_retrieved_stage1=len(stage1_candidates),
        total_reranked_stage2=len(stage2_candidates),
        final_evaluations=final_results
    )
