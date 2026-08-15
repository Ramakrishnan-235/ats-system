import logging
from typing import Optional
from openai import OpenAI
import instructor
from pydantic import ValidationError

from ats_core.schema.candidate import CandidateProfile

logger = logging.getLogger("ats.parsers.ollama")

class OllamaCandidateExtractor:
    """Extracts structured CandidateProfile from sanitized text using a local Ollama model."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        model_name: str = "gemma4:e2b",
        temperature: float = 0.0,
        max_retries: int = 3,
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.max_retries = max_retries

        # Initialize standard OpenAI client pointed at Ollama
        raw_client = OpenAI(
            base_url=base_url,
            api_key="ollama",  # Required non-empty string for OpenAI client
        )

        # Patch client with Instructor using JSON mode for local LLMs
        self.client = instructor.from_openai(
            raw_client,
            mode=instructor.Mode.JSON
        )

    def extract_profile(self, anonymized_text: str) -> CandidateProfile:
        """
        Parses anonymized resume text into a validated CandidateProfile.
        Includes automatic retry logic when Pydantic constraints fail.
        """
        system_instruction = (
            "You are an expert ATS parsing system. Extract all candidate information "
            "strictly adhering to the requested JSON schema. Calculate total continuous "
            "years of experience accurately, categorize skills into the standard taxonomy, "
            "and identify any employment gaps exceeding 3 months."
        )

        prompt = f"""
        Extract the full candidate profile from the sanitized resume markdown below:

        --- RESUME CONTENT ---
        {anonymized_text}
        --- END RESUME CONTENT ---
        """

        try:
            profile: CandidateProfile = self.client.chat.completions.create(
                model=self.model_name,
                response_model=CandidateProfile,
                max_retries=self.max_retries,
                temperature=self.temperature,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
            )
            return profile
        except ValidationError as ve:
            logger.error(f"Pydantic Validation failed after {self.max_retries} retries: {ve}")
            raise ve
        except Exception as e:
            logger.error(f"Ollama structured extraction failed: {e}")
            raise RuntimeError(f"Extraction failed: {e}")