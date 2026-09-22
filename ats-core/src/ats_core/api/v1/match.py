import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("ats.api.match")

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
    reranker_fallback: bool = Field(default=False, description="True if reranker encountered error and fell back to hybrid search")


@router.post("/evaluate-job", response_model=MatchResponse)
async def match_and_evaluate_candidates(request: MatchRequest):
    query_text = f"Title: {request.job_title}\nRequirements: {request.job_description}"
    reranker_fallback = False

    # -------------------------------------------------------------------------
    # STAGE 1: Hybrid Retrieval -> Top 100 (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    try:
        retriever = get_retriever()
        stage1_candidates = await run_in_threadpool(
            retriever.hybrid_search,
            query=query_text,
            top_k=request.stage1_retrieve_limit
        )
    except Exception as e:
        logger.exception(f"Stage 1 hybrid retrieval failed for job '{request.job_title}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Candidate retrieval failure: {str(e)}"
        )

    if not stage1_candidates:
        logger.info(f"No candidate records retrieved for job '{request.job_title}'.")
        return MatchResponse(
            job_title=request.job_title,
            total_retrieved_stage1=0,
            total_reranked_stage2=0,
            final_evaluations=[],
            reranker_fallback=False
        )

    # -------------------------------------------------------------------------
    # STAGE 2: Cross-Encoder Re-Ranking -> Top 20 (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    try:
        reranker = get_reranker()
        stage2_candidates = await run_in_threadpool(
            reranker.rerank,
            query=query_text,
            candidates=stage1_candidates,
            top_k=request.stage2_rerank_limit
        )
    except Exception as e:
        logger.warning(
            f"Stage 2 cross-encoder reranker encountered error for job '{request.job_title}'. "
            f"Falling back to Stage 1 rankings: {e}",
            exc_info=True
        )
        reranker_fallback = True
        stage2_candidates = stage1_candidates[:request.stage2_rerank_limit]

    # -------------------------------------------------------------------------
    # STAGE 3: Deep LLM Evaluation (Top 20 only) (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    from ats_core.evaluator.llm_evaluator import evaluate_candidate, EvaluationReport
    final_results = []
    for cand in stage2_candidates:
        cand_id = cand.get("candidate_id", "unknown")
        cand_text = cand.get("text", cand.get("summary_text", ""))
        try:
            report: EvaluationReport = await run_in_threadpool(
                evaluate_candidate,
                candidate_summary=cand_text,
                job_description=request.job_description
            )
            final_results.append({
                "candidate_id": cand_id,
                "rerank_score": cand.get("rerank_score", 0.95),
                "rerank_rank": cand.get("rerank_rank", 1),
                "evaluation": report.model_dump()
            })
        except Exception as cand_err:
            logger.error(
                f"Stage 3 LLM evaluation failed for candidate '{cand_id}': {cand_err}",
                exc_info=True
            )

    if not final_results and stage2_candidates:
        logger.error(
            f"Stage 3 failed to evaluate any of the {len(stage2_candidates)} candidates for job '{request.job_title}'."
        )

    # Sort final output by LLM overall match score
    final_results.sort(key=lambda x: x["evaluation"]["match_score"], reverse=True)

    return MatchResponse(
        job_title=request.job_title,
        total_retrieved_stage1=len(stage1_candidates),
        total_reranked_stage2=len(stage2_candidates),
        final_evaluations=final_results,
        reranker_fallback=reranker_fallback
    )
