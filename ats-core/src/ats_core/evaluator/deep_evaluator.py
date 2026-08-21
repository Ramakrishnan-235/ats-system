import logging
import time
from typing import Dict, Any, Optional
from openai import OpenAI
import instructor

from ats_core.schema.evaluation import (
    DeepCandidateEvaluationReport,
    QualificationTier,
    CriterionScore,
    CriterionCategory,
    SuggestedInterviewQuestion,
    QuestionCategory,
)

logger = logging.getLogger("ats.evaluator.deep")


class LocalDeepEvaluator:
    """
    Stage 3 Deep LLM Evaluator powered by local Ollama models (e.g. gemma4:e2b).
    Produces structured scorecards, evidence citations, and tailored interview plans.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        model_name: str = "gemma4:e2b",
        temperature: float = 0.1,
        max_retries: int = 3,
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.max_retries = max_retries
        self.base_url = base_url

        # Initialize OpenAI client pointed to local Ollama server
        raw_client = OpenAI(
            base_url=base_url,
            api_key="ollama",  # Placeholder non-empty API key for OpenAI SDK
        )

        # Patch client with Instructor using JSON Schema mode
        self.client = instructor.from_openai(
            raw_client,
            mode=instructor.Mode.JSON,
        )
        logger.info(f"Initialized Deep Evaluator with Ollama model: {self.model_name}")

    def _build_evaluation_prompt(
        self,
        candidate_id: str,
        candidate_profile: str,
        job_title: str,
        job_description: str,
    ) -> str:
        return f"""
You are a Staff Technical Hiring Committee Lead and Principal Architect.
Your task is to conduct an uncompromising, objective technical evaluation of a candidate against a specific Job Description.

### EVALUATION RULES:
1. Ground every claim in verifiable evidence. If quoting from the resume, populate `verbatim_citation` with the exact snippet.
2. Differentiate between active technical ownership (e.g., "architected", "designed", "optimized") and passive participation (e.g., "assisted", "used", "monitored").
3. Penalize buzzword stuffing that lacks quantifiable metrics or technical depth.
4. Calibrate the overall score:
   - 80-100 (Strong Fit): Exceeds core requirements with proven high-scale impact.
   - 60-79 (Potential Fit): Solid foundational skills with minor gaps in specific frameworks or domain depth.
   - 0-59 (Low Match): Missing core prerequisites, insufficient experience, or level mismatch.

--- TARGET JOB REQUISITION ---
Role Title: {job_title}
Job Description:
{job_description}

--- CANDIDATE DOSSIER ---
Candidate ID: {candidate_id}
Profile & Work History:
{candidate_profile}

Generate the complete structured evaluation report adhering strictly to the schema.
"""

    def evaluate(
        self,
        candidate_id: str,
        candidate_profile_text: str,
        job_title: str,
        job_description: str,
    ) -> Dict[str, Any]:
        """
        Executes deep evaluation and returns structured report alongside performance telemetry.
        """
        prompt = self._build_evaluation_prompt(
            candidate_id=candidate_id,
            candidate_profile=candidate_profile_text,
            job_title=job_title,
            job_description=job_description,
        )

        system_message = (
            "You are a rigorous technical evaluator. Output strictly validated JSON "
            "satisfying the provided schema without any introductory text or markdown wrappers."
        )

        t_start = time.time()

        try:
            report: DeepCandidateEvaluationReport = self.client.chat.completions.create(
                model=self.model_name,
                response_model=DeepCandidateEvaluationReport,
                max_retries=self.max_retries,
                temperature=self.temperature,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ],
            )
            latency_ms = int((time.time() - t_start) * 1000)

            # Ensure the candidate ID and job title match the request
            report.candidate_id = candidate_id
            report.job_title = job_title

            logger.info(
                f"Candidate {candidate_id} evaluated: Score={report.overall_match_score} "
                f"({report.qualification_tier}) in {latency_ms}ms"
            )

            return {
                "success": True,
                "report": report,
                "telemetry": {
                    "model": self.model_name,
                    "latency_ms": latency_ms,
                },
            }

        except Exception as e:
            latency_ms = int((time.time() - t_start) * 1000)
            logger.error(f"Deep evaluation failed for candidate {candidate_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "telemetry": {
                    "model": self.model_name,
                    "latency_ms": latency_ms,
                },
            }
