"""
llm_residue_extractor.py
Step 5: The LLM Residue Pass (Anti-Hallucination Grounded).

After dictionary and gazetteer matching, runs a constrained LLM call to catch what the taxonomy missed:
niche internal tools, emerging frameworks, or domain skills.

Rules:
1. Exact verbatim evidence containment check: evidence must be a substring in source text.
2. Anti-hallucination discard: any skill with missing evidence or failed containment is dropped.
3. Flywheel ingestion: verified new skills are inserted into taxonomy as status='pending', source='llm'.
"""

import logging
import os
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from openai import OpenAI
import instructor

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService

logger = logging.getLogger("ats.parsers.llm_residue")

RESIDUE_PROMPT = """You extract skills from resume text that a dictionary matcher missed.

You will receive: the resume text, and SKILLS_ALREADY_FOUND (canonical names).
Extract ONLY additional concrete technologies, tools, frameworks, methodologies, or
domain skills that appear in the text and are NOT in SKILLS_ALREADY_FOUND.

RULES:
1. For each skill: provide the skill 'name', and 'evidence' — the EXACT verbatim substring
   of the resume containing it. If you cannot quote it verbatim from the text, do not include it.
2. Do not infer skills that aren't written (e.g., no "REST APIs" because you see "HTTP").
3. Do not include soft skills unless explicitly listed in a skills section.
4. Do not include company names, job titles, universities, degrees, or locations.
"""


class LLMResidueSkill(BaseModel):
    name: str = Field(..., description="Name of the newly discovered technical skill or tool.")
    evidence: str = Field(..., description="EXACT verbatim substring from the resume text proving this skill.")


class LLMResidueOutput(BaseModel):
    new_skills: List[LLMResidueSkill] = Field(
        default_factory=list,
        description="List of newly discovered skills with verbatim source text evidence."
    )


class LLMResidueExtractor:
    """
    Executes the LLM residue extraction pass with strict anti-hallucination substring verification.
    """
    _instance: Optional["LLMResidueExtractor"] = None

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.0,
    ):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        self.model_name = model_name or os.getenv("OLLAMA_MODEL", "deepseek-v4-flash:cloud")
        self.temperature = temperature
        self._client: Optional[instructor.Instructor] = None

    @classmethod
    def get_instance(cls) -> "LLMResidueExtractor":
        if cls._instance is None:
            cls._instance = LLMResidueExtractor()
        return cls._instance

    @property
    def client(self) -> instructor.Instructor:
        if self._client is None:
            raw_client = OpenAI(
                base_url=self.base_url,
                api_key="ollama",
            )
            self._client = instructor.from_openai(
                raw_client,
                mode=instructor.Mode.JSON
            )
        return self._client

    def extract_residue_skills(
        self,
        resume_text: str,
        skills_already_found: List[str],
        register_flywheel: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Executes residue extraction pass:
        1. Calls LLM with RESIDUE_PROMPT and schema constraints.
        2. Strict verification: Discards any item where evidence is NOT in resume_text verbatim.
        3. Persists valid unmapped items to Flywheel queue with status='pending', source='llm'.
        """
        if not resume_text or not resume_text.strip():
            return []

        user_prompt = f"""
        <resume_text>
        {resume_text}
        </resume_text>

        <skills_already_found>
        {', '.join(skills_already_found)}
        </skills_already_found>
        """

        verified_skills: List[Dict[str, Any]] = []

        try:
            res: LLMResidueOutput = self.client.chat.completions.create(
                model=self.model_name,
                response_model=LLMResidueOutput,
                temperature=self.temperature,
                max_retries=2,
                messages=[
                    {"role": "system", "content": RESIDUE_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw_candidates = res.new_skills
        except Exception as e:
            logger.warning(f"Ollama residue pass unavailable or failed: {e}. Running fallback rule residue.")
            raw_candidates = self._fallback_rule_residue(resume_text, skills_already_found)

        taxonomy_service = SkillTaxonomyService.get_instance()

        for cand in raw_candidates:
            clean_name = cand.name.strip()
            clean_evidence = cand.evidence.strip()

            if not clean_name or not clean_evidence:
                continue

            # ANTI-HALLUCINATION SHIELD: Strict Verbatim Containment Check
            if clean_evidence.lower() not in resume_text.lower():
                logger.info(f"Discarded hallucinated LLM skill '{clean_name}': evidence '{clean_evidence}' not in source text.")
                continue

            # Ensure not already in skills_already_found
            if any(clean_name.lower() == s.lower() for s in skills_already_found):
                continue

            # Register into Flywheel review queue
            registered_row = {}
            if register_flywheel:
                registered_row = taxonomy_service.record_unknown_skill(
                    raw_skill=clean_name,
                    source="llm",
                    context=clean_evidence
                )

            verified_skills.append({
                "name": clean_name,
                "evidence": clean_evidence,
                "skill_id": registered_row.get("id"),
                "status": "pending",
                "source": "llm",
            })

        logger.info(f"LLM Residue Pass verified {len(verified_skills)} new skills from resume text.")
        return verified_skills

    def _fallback_rule_residue(
        self,
        resume_text: str,
        skills_already_found: List[str]
    ) -> List[LLMResidueSkill]:
        """
        Deterministic fallback if local LLM is offline.
        Inspects capitalized technical terms in project/experience lines.
        """
        import re
        lines = resume_text.split("\n")
        already_set = {s.lower() for s in skills_already_found}
        results = []

        for line in lines:
            if not line.strip() or len(line) < 20:
                continue
            # Look for technical tokens like 'LangChain', 'Manim', 'Spline', 'Roboflow', 'ChromaDB'
            matches = re.finditer(r"\b([A-Z][a-zA-Z0-9_]{3,20}(?:DB|Engine|AI|Flow|Stack|Hub|API)?)\b", line)
            for m in matches:
                tok = m.group(1).strip()
                if tok.lower() not in already_set and tok.lower() not in {"software", "engineer", "developer", "experience", "education", "project", "university", "college", "summary", "skills"}:
                    results.append(LLMResidueSkill(name=tok, evidence=line.strip()[:100]))
                    already_set.add(tok.lower())

        return results[:5]
