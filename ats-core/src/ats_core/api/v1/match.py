import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, model_validator
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


def sync_candidates_to_retriever(retriever, job_id: Optional[str] = None) -> int:
    """
    Collects candidates from CANDIDATES_STORE, JOB_CANDIDATES_STORE, and PostgreSQL
    (if available), formats their searchable text and metadata, and indexes them
    into the HybridCandidateRetriever. Returns count of newly indexed records.
    """
    from ats_core.api.v1.candidates import CANDIDATES_STORE
    from ats_core.api.v1.jobs import JOB_CANDIDATES_STORE

    gathered: Dict[str, Dict[str, Any]] = {}

    # 1. Gather all candidates from in-memory CANDIDATES_STORE
    for cid, cand in CANDIDATES_STORE.items():
        if cid and isinstance(cand, dict):
            gathered[str(cid)] = cand

    # 2. Gather candidates from in-memory JOB_CANDIDATES_STORE
    for j_id, j_cands in JOB_CANDIDATES_STORE.items():
        if isinstance(j_cands, list):
            for jc in j_cands:
                if isinstance(jc, dict) and jc.get("id"):
                    cid = str(jc["id"])
                    if cid not in gathered:
                        gathered[cid] = {
                            "id": cid,
                            "name": jc.get("name", "Candidate"),
                            "target_headline": jc.get("headline", ""),
                            "core_skills": jc.get("skills", []),
                            "raw_text": jc.get("quote", ""),
                            "stage": jc.get("stage", "Screening"),
                        }

    # 3. Gather candidates from PostgreSQL database if accessible
    try:
        from ats_core.models.db import Candidate
        from ats_core.workers.tasks import get_session_factory
        with get_session_factory()() as session:
            db_candidates = session.query(Candidate).all()
            for db_c in db_candidates:
                cid = str(db_c.id)
                if cid not in gathered:
                    gathered[cid] = {
                        "id": cid,
                        "name": db_c.anonymized_name,
                        "target_headline": db_c.target_headline,
                        "core_skills": db_c.core_skills or [],
                        "raw_text": db_c.raw_anonymized_text or "",
                        "highest_education": db_c.highest_education or "",
                        "years_of_experience": float(db_c.years_of_experience or 0),
                    }
    except Exception as db_err:
        logger.debug("Database candidates fetch skipped: %s", db_err)

    if not gathered:
        return 0

    records_to_index = []
    dense_embeddings = getattr(retriever, "dense_embeddings", {})
    candidate_corpus = getattr(retriever, "candidate_corpus", {})

    for cid, cand in gathered.items():
        # Only index if not already present
        if cid in dense_embeddings and cid in candidate_corpus:
            continue

        text_parts = []
        name = cand.get("name", "")
        headline = cand.get("target_headline") or cand.get("role") or ""
        skills = cand.get("core_skills") or cand.get("skills") or []
        education = cand.get("highest_education", "")
        years_exp = cand.get("years_of_experience", 0.0)
        raw_text = cand.get("raw_text") or cand.get("raw_anonymized_text") or ""
        experience = cand.get("experience") or []

        if name and name != "Candidate":
            text_parts.append(f"Candidate: {name}")
        if headline:
            text_parts.append(f"Title/Role: {headline}")
        if skills:
            skills_str = ", ".join(skills) if isinstance(skills, list) else str(skills)
            text_parts.append(f"Skills: {skills_str}")
        if education and education != "N/A":
            text_parts.append(f"Education: {education}")
        if years_exp:
            text_parts.append(f"Experience: {years_exp} years")
        if raw_text:
            text_parts.append(raw_text)
        elif experience:
            exp_strs = []
            for exp in experience:
                if isinstance(exp, dict):
                    exp_strs.append(f"{exp.get('role', '')} at {exp.get('company', '')}: {exp.get('description', '')}")
                else:
                    exp_strs.append(str(exp))
            if exp_strs:
                text_parts.append("\n".join(exp_strs))

        doc_text = "\n".join(text_parts).strip() or headline or "Candidate Profile"

        records_to_index.append({
            "id": cid,
            "text": doc_text,
            "metadata": {
                "name": name,
                "title": headline,
                "skills": skills,
                "years_of_experience": years_exp,
            }
        })

    if records_to_index and hasattr(retriever, "index_candidates"):
        try:
            retriever.index_candidates(records_to_index)
            logger.info("Successfully indexed %d candidate profiles into HybridCandidateRetriever.", len(records_to_index))
        except Exception as idx_err:
            logger.warning("Failed indexing candidate batch into retriever: %s", idx_err, exc_info=True)

    return len(records_to_index)


class MatchRequest(BaseModel):
    job_id: Optional[str] = Field(default=None, description="Optional target job ID to link and rank candidates")
    job_title: str = Field(min_length=1, max_length=255)
    job_description: str = Field(min_length=1, max_length=50000)
    stage1_retrieve_limit: int = Field(default=100, ge=1, le=500, description="Number of candidates from hybrid search")
    stage2_rerank_limit: int = Field(default=20, ge=1, le=50, description="Candidates sent to deep LLM evaluation")

    @model_validator(mode="after")
    def validate_stage_limits(self):
        if self.stage2_rerank_limit > self.stage1_retrieve_limit:
            raise ValueError("stage2_rerank_limit cannot exceed stage1_retrieve_limit")
        return self


class MatchResponse(BaseModel):
    job_id: Optional[str] = None
    job_title: str
    total_retrieved_stage1: int = Field(default=0)
    total_reranked_stage2: int = Field(default=0)
    stage1_candidates_retrieved: int = Field(default=0)
    stage2_candidates_reranked: int = Field(default=0)
    stage3_final_ranked: int = Field(default=0)
    final_evaluations: List[Dict[str, Any]] = Field(default_factory=list)
    candidates: List[Dict[str, Any]] = Field(default_factory=list, description="Ranked candidates for this job")
    failed_candidate_ids: List[str] = Field(default_factory=list)
    reranker_fallback: bool = Field(default=False, description="True if reranker encountered error and fell back to hybrid search")
    message: Optional[str] = None


@router.post("/evaluate-job", response_model=MatchResponse)
async def match_and_evaluate_candidates(request: MatchRequest):
    query_text = f"Title: {request.job_title}\nRequirements: {request.job_description}"
    reranker_fallback = False

    # -------------------------------------------------------------------------
    # STAGE 1: Hybrid Retrieval -> Top N (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    try:
        retriever = await run_in_threadpool(get_retriever)
        await run_in_threadpool(sync_candidates_to_retriever, retriever, request.job_id)
        stage1_candidates = await run_in_threadpool(
            retriever.hybrid_search,
            query=query_text,
            top_k=request.stage1_retrieve_limit
        )
    except Exception as e:
        logger.exception(f"Stage 1 hybrid retrieval failed for job '{request.job_title}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Candidate retrieval failed."
        ) from None

    # Fallback to direct candidate pool if hybrid search returns empty but store has candidates
    if not stage1_candidates:
        from ats_core.api.v1.candidates import CANDIDATES_STORE
        all_store_cands = list(CANDIDATES_STORE.values())
        if all_store_cands:
            logger.info("Hybrid search returned 0 candidates, using %d store candidates directly.", len(all_store_cands))
            stage1_candidates = []
            for c in all_store_cands[:request.stage1_retrieve_limit]:
                cid = str(c.get("id"))
                cand_text = c.get("raw_text") or c.get("raw_anonymized_text") or f"{c.get('target_headline', '')}. Skills: {', '.join(c.get('core_skills', []))}"
                stage1_candidates.append({
                    "candidate_id": cid,
                    "text": cand_text,
                    "metadata": {
                        "name": c.get("name", "Candidate"),
                        "title": c.get("target_headline", ""),
                        "skills": c.get("core_skills", []),
                    }
                })

    if not stage1_candidates:
        logger.info(f"No candidate records retrieved for job '{request.job_title}'.")
        return MatchResponse(
            job_id=request.job_id,
            job_title=request.job_title,
            total_retrieved_stage1=0,
            total_reranked_stage2=0,
            final_evaluations=[],
            candidates=[],
            reranker_fallback=False,
            message="No candidate records found in talent pool to match."
        )

    # -------------------------------------------------------------------------
    # STAGE 2: Cross-Encoder Re-Ranking -> Top N (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    try:
        reranker = await run_in_threadpool(get_reranker)
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
    # STAGE 3: Deep LLM Evaluation (Top candidates only) (Non-blocking worker thread)
    # -------------------------------------------------------------------------
    from ats_core.evaluator.llm_evaluator import evaluate_candidate, EvaluationReport
    final_results = []
    failed_candidate_ids = []
    for rank, cand in enumerate(stage2_candidates, start=1):
        cand_id = cand.get("candidate_id", "unknown")
        cand_text = cand.get("text", cand.get("summary_text", ""))
        try:
            report: EvaluationReport = await run_in_threadpool(
                evaluate_candidate,
                candidate_summary=cand_text,
                job_description=request.job_description
            )
            eval_data = (
                report.model_dump()
                if hasattr(report, "model_dump")
                else (report.dict() if hasattr(report, "dict") else (vars(report) if hasattr(report, "__dict__") else {}))
            )
            final_results.append({
                "candidate_id": cand_id,
                "rerank_score": cand.get("rerank_score"),
                "rerank_rank": cand.get("rerank_rank", rank),
                "evaluation": eval_data,
                "metadata": cand.get("metadata", {}),
            })
        except Exception as cand_err:
            failed_candidate_ids.append(cand_id)
            logger.error(
                f"Stage 3 LLM evaluation failed for candidate '{cand_id}': {cand_err}",
                exc_info=True
            )

    if not final_results and stage2_candidates:
        logger.error(
            f"Stage 3 failed to evaluate any of the {len(stage2_candidates)} candidates for job '{request.job_title}'."
        )
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Candidate evaluation failed for all retrieved candidates.")

    def _get_eval_score(x):
        ev = x.get("evaluation", {})
        val = ev.get("overall_match_score")
        if val is None:
            val = ev.get("match_score", 0)
        try:
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    # Sort final output by LLM overall match score
    final_results.sort(key=_get_eval_score, reverse=True)

    # -------------------------------------------------------------------------
    # STAGE 4: Update Candidate Scorecards & Job Pipeline
    # -------------------------------------------------------------------------
    from ats_core.api.v1.candidates import CANDIDATES_STORE
    from ats_core.api.v1.jobs import JOBS_STORE, JOB_CANDIDATES_STORE

    target_job_id = request.job_id
    if not target_job_id:
        for jid, jdata in JOBS_STORE.items():
            if jdata.get("title", "").strip().lower() == request.job_title.strip().lower():
                target_job_id = jid
                break

    updated_job_candidates = []
    for rank_idx, item in enumerate(final_results, start=1):
        cid = item["candidate_id"]
        eval_data = item["evaluation"]
        match_score = int(round(_get_eval_score(item)))
        tier = eval_data.get("qualification_tier", "Potential Fit")
        tier_label = f"{tier} Match" if "Match" not in str(tier) else str(tier)

        # Update candidate scorecard in CANDIDATES_STORE
        if cid in CANDIDATES_STORE:
            cand = CANDIDATES_STORE[cid]
            if target_job_id:
                cand["applied_for_job_id"] = target_job_id
                if target_job_id in JOBS_STORE:
                    cand["applied_for_job"] = f"{JOBS_STORE[target_job_id]['title']} ({JOBS_STORE[target_job_id].get('department', 'Engineering')})"

            scorecard = cand.setdefault("scorecard", {})
            scorecard["overall_match_score"] = match_score
            scorecard["match_tier"] = tier_label
            scorecard["evaluation_status"] = "COMPLETED"
            scorecard["evaluated_at"] = datetime.now(timezone.utc).isoformat()

            cats = []
            for crit in eval_data.get("criteria_breakdown", []):
                sc = crit.get("score", 0.0)
                sc_10 = round(sc / 10.0, 1) if sc > 10.0 else round(sc, 1)
                cats.append({
                    "name": crit.get("criterion", "Technical Fit"),
                    "score": sc_10,
                    "max_score": 10.0,
                    "quote": crit.get("rationale", ""),
                    "source_ref": f"Evidence: {crit.get('criterion', '')}"
                })
            if cats:
                scorecard["categories"] = cats
            scorecard["risk_flags"] = eval_data.get("cons_or_risks", [])
            scorecard["suggested_improvements"] = eval_data.get("pros", [])
            scorecard["suggested_questions"] = eval_data.get("recommended_interview_questions", [])

        # Build JobCandidate item
        cand_rec = CANDIDATES_STORE.get(cid, {})
        name = cand_rec.get("name") or item.get("metadata", {}).get("name") or f"Candidate #{cid[-6:]}"
        headline = cand_rec.get("target_headline") or item.get("metadata", {}).get("title") or request.job_title
        initials = "".join([part[0] for part in name.split()[:2]]).upper() or "CD"
        avatar = cand_rec.get("avatar") or initials
        skills = cand_rec.get("core_skills") or item.get("metadata", {}).get("skills") or []
        stage = cand_rec.get("stage", "Screening")

        cat_list = eval_data.get("criteria_breakdown", [])
        tech_score = round(cat_list[0].get("score", 7.5) / 10.0, 1) if cat_list and cat_list[0].get("score", 0) > 10 else (cat_list[0].get("score", 7.5) if cat_list else 7.5)
        sys_score = round(cat_list[1].get("score", 7.0) / 10.0, 1) if len(cat_list) > 1 and cat_list[1].get("score", 0) > 10 else (cat_list[1].get("score", 7.0) if len(cat_list) > 1 else 7.0)

        job_cand_obj = {
            "id": cid,
            "rank": rank_idx,
            "name": name,
            "headline": headline,
            "avatar": avatar,
            "isImageAvatar": False,
            "matchScore": match_score,
            "matchLabel": tier_label,
            "skills": skills,
            "stage": stage,
            "stageBadgeStyle": "bg-zinc-100 text-zinc-700",
            "technicalDepthScore": tech_score,
            "systemDesignScore": sys_score,
            "quote": cat_list[0].get("rationale", "") if cat_list else eval_data.get("recruiter_summary", ""),
            "sourceResumeLink": f"/candidates/{cid}",
            "potentialGap": eval_data.get("cons_or_risks", [None])[0] if eval_data.get("cons_or_risks") else None,
            "suggestedQuestions": eval_data.get("recommended_interview_questions", []),
            "jobId": target_job_id,
        }
        updated_job_candidates.append(job_cand_obj)

    if target_job_id and target_job_id in JOBS_STORE:
        existing_map = {c["id"]: c for c in JOB_CANDIDATES_STORE.get(target_job_id, [])}
        for jc in updated_job_candidates:
            existing_map[jc["id"]] = jc

        merged_list = list(existing_map.values())
        merged_list.sort(key=lambda c: (c.get("matchScore") or 0, c.get("technicalDepthScore") or 0.0), reverse=True)
        for idx, c in enumerate(merged_list):
            c["rank"] = idx + 1

        JOB_CANDIDATES_STORE[target_job_id] = merged_list
        JOBS_STORE[target_job_id]["candidates_count"] = len(merged_list)
        if merged_list:
            top_cand = merged_list[0]
            JOBS_STORE[target_job_id]["top_match"] = {
                "score": top_cand.get("matchScore"),
                "label": top_cand.get("matchLabel") or "Top Match",
                "last_run": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
                "status": "COMPLETED"
            }
        updated_job_candidates = merged_list

    return MatchResponse(
        job_id=target_job_id,
        job_title=request.job_title,
        total_retrieved_stage1=len(stage1_candidates),
        total_reranked_stage2=len(stage2_candidates),
        stage1_candidates_retrieved=len(stage1_candidates),
        stage2_candidates_reranked=len(stage2_candidates),
        stage3_final_ranked=len(final_results),
        final_evaluations=final_results,
        candidates=updated_job_candidates,
        failed_candidate_ids=failed_candidate_ids,
        reranker_fallback=reranker_fallback,
        message=f"Successfully evaluated and matched {len(final_results)} candidates."
    )
