"""
llm_residue_extractor.py
Step 5: The LLM Residue Pass (Anti-Hallucination Grounded) via LangChain.

After dictionary and gazetteer matching, runs a constrained LLM call to catch what the taxonomy missed:
niche internal tools, emerging frameworks, or domain skills using LangChain connected to OpenRouter.

Rules:
1. Exact verbatim evidence containment check: evidence must be a substring in source text.
2. Anti-hallucination discard: any skill with missing evidence or failed containment is dropped.
3. Flywheel ingestion: verified new skills are inserted into taxonomy as status='pending', source='llm'.
"""

import logging
import os
import json
import re
import threading
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService, RESUME_PROSE_STOPWORDS
from ats_core.llm.client import get_openrouter_chat_model, get_structured_llm, get_llm_config
from ats_core.llm.sanitizer import sanitize_prompt_text

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

USER_RESIDUE_TEMPLATE = """
<resume_text>
{safe_resume_text}
</resume_text>

<skills_already_found>
{skills_already_found}
</skills_already_found>
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
    Executes the LLM residue extraction pass using LangChain with strict anti-hallucination substring verification.
    """
    _instance: Optional["LLMResidueExtractor"] = None
    _instance_lock: threading.Lock = threading.Lock()

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        temperature: float = 0.0,
    ):
        config = get_llm_config(base_url=base_url, model_name=model_name, api_key=api_key)
        self.base_url = config["base_url"]
        self.model_name = config["model_name"]
        self.api_key = config["api_key"]
        self.is_openrouter = config["is_openrouter"]
        self.temperature = temperature
        self._client: Any = None
        self._anonymizer = None
        self._anonymizer_lock = threading.Lock()

        # LangChain Chat Model & Structured Runnable
        self.chat_model = get_openrouter_chat_model(
            base_url=self.base_url,
            model_name=self.model_name,
            api_key=self.api_key,
            temperature=self.temperature,
        )
        self.structured_llm = get_structured_llm(
            schema=LLMResidueOutput,
            chat_model=self.chat_model,
        )

        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", RESIDUE_PROMPT),
            ("human", USER_RESIDUE_TEMPLATE),
        ])
        self.chain: Runnable[Any, LLMResidueOutput] = self.prompt_template | self.structured_llm

    @classmethod
    def get_instance(cls) -> "LLMResidueExtractor":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = LLMResidueExtractor()
        return cls._instance

    @property
    def client(self) -> Any:
        if self._client is None:
            # Compatibility client when accessed
            return self
        return self._client

    @client.setter
    def client(self, value: Any) -> None:
        self._client = value

    def _redact_for_llm(self, resume_text: str) -> str:
        """Initialize redaction on demand, before accessing any LLM client."""
        if self._anonymizer is None:
            with self._anonymizer_lock:
                if self._anonymizer is None:
                    from ats_core.parsers.anonymizer import ResumeAnonymizer

                    self._anonymizer = ResumeAnonymizer(min_score_threshold=0.55)
        redacted = self._anonymizer.anonymize(resume_text)
        return re.sub(
            r"\b(?:https?://|www\.)[^\s]+|(?<!\w)(?:linkedin\.com|github\.com)/[^\s]+",
            "[PROFILE_URL]", redacted, flags=re.IGNORECASE,
        )

    def _sanitize_text(self, text: str) -> str:
        """Neutralizes prompt injection directives in untrusted text."""
        return sanitize_prompt_text(text)

    def extract_residue_skills(
        self,
        resume_text: str,
        skills_already_found: List[str],
        register_flywheel: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes residue extraction pass:
        1. Redacts resume PII before accessing the LLM; uses local rules if unavailable.
        2. Strict verification: Discards any item where evidence is NOT in resume_text verbatim.
        3. Persists valid unmapped items to Flywheel queue with status='pending', source='llm'
           (bounded per resume and gated by ATS_FLYWHEEL_AUTO_REGISTER).
        """
        if not resume_text or not resume_text.strip():
            return []

        if register_flywheel is None:
            register_flywheel = os.getenv("ATS_FLYWHEEL_AUTO_REGISTER", "false").strip().lower() in ("true", "1", "yes")

        max_flywheel_per_resume = int(os.getenv("ATS_MAX_FLYWHEEL_PER_RESUME", "5"))
        flywheel_registered_count = 0

        verified_skills: List[Dict[str, Any]] = []
        try:
            safe_resume_text = self._redact_for_llm(resume_text)
            if not safe_resume_text or not safe_resume_text.strip():
                raise ValueError("Redacted resume text is empty")
        except Exception:
            logger.warning("Residue PII redaction unavailable; using local rule extraction only.")
            raw_candidates = self._fallback_rule_residue(resume_text, skills_already_found)
        else:
            safe_resume_text = sanitize_prompt_text(safe_resume_text)
            safe_skills_list = [sanitize_prompt_text(s) for s in skills_already_found]
            safe_skills_str = ", ".join(safe_skills_list)
            user_prompt = f"""
            <resume_text>
            {safe_resume_text}
            </resume_text>

            <skills_already_found>
            {safe_skills_str}
            </skills_already_found>
            """
            try:
                # Check if legacy client property is accessed/mocked
                active_client = self.client
                if active_client is not self and hasattr(active_client, "chat"):
                    res: LLMResidueOutput = active_client.chat.completions.create(
                        model=self.model_name,
                        response_model=LLMResidueOutput,
                        temperature=self.temperature,
                        max_retries=2,
                        messages=[
                            {"role": "system", "content": RESIDUE_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                    )
                else:
                    raw_res = self.chain.invoke({
                        "safe_resume_text": safe_resume_text,
                        "skills_already_found": safe_skills_str,
                    })
                    if isinstance(raw_res, LLMResidueOutput):
                        res = raw_res
                    elif isinstance(raw_res, dict):
                        res = LLMResidueOutput.model_validate(raw_res)
                    else:
                        res = LLMResidueOutput.model_validate(raw_res)
                raw_candidates = res.new_skills
            except Exception as e:
                logger.warning(f"Residue pass unavailable ({e}); using local rule extraction.")
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

            # Register into Flywheel review queue (bounded per resume)
            registered_row = {}
            if (
                register_flywheel
                and flywheel_registered_count < max_flywheel_per_resume
                and hasattr(taxonomy_service, "record_unknown_skill")
            ):
                registered_row = taxonomy_service.record_unknown_skill(
                    raw_skill=clean_name,
                    source="llm",
                    context=clean_evidence
                )
                if registered_row and isinstance(registered_row, dict) and registered_row.get("id"):
                    flywheel_registered_count += 1

            verified_skills.append({
                "name": clean_name,
                "evidence": clean_evidence,
                "skill_id": registered_row.get("id") if isinstance(registered_row, dict) else None,
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
        Inspects strictly validated technical terms (CamelCase or technical suffixes)
        in project/experience lines while filtering prose stopwords and generic words.
        """
        lines = resume_text.split("\n")
        already_set = {s.lower() for s in skills_already_found}
        results: List[LLMResidueSkill] = []

        # Technical token matchers:
        # 1. CamelCase (e.g. DeltaLake, LangChain, RoboFlow, TensorFlow, PyTorch, AirFlow)
        # 2. Mandatory technical suffix (e.g. ChromaDB, DuckDB, GraphQL, LangFlow, DevOps, RESTAPI)
        camel_pattern = re.compile(r"\b[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*\b")
        tech_suffix_pattern = re.compile(r"\b[A-Z][a-zA-Z0-9]{2,18}(?:DB|SQL|Engine|Flow|Stack|Hub|API|SDK|CLI|Ops)\b")

        for line in lines:
            if not line.strip() or len(line) < 20:
                continue

            matched_tokens = set(camel_pattern.findall(line) + tech_suffix_pattern.findall(line))
            for tok in sorted(matched_tokens):
                tok_clean = tok.strip()
                tok_lower = tok_clean.lower()

                if len(tok_clean) < 3 or len(tok_clean) > 25:
                    continue
                if tok_lower in already_set:
                    continue
                if tok_lower in RESUME_PROSE_STOPWORDS:
                    continue

                results.append(LLMResidueSkill(name=tok_clean, evidence=line.strip()[:100]))
                already_set.add(tok_lower)
                if len(results) >= 5:
                    return results

        return results
