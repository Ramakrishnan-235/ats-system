import logging
from typing import List, Optional
from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig, EngineResult

logger = logging.getLogger("ats.parsers.anonymizer")


class ResumeAnonymizer:
    """
    Sanitizes PII from resumes using Microsoft Presidio.
    Targets: PERSON, EMAIL_ADDRESS, PHONE_NUMBER, LOCATION.
    """

    DEFAULT_ENTITIES = [
        "PERSON",
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "LOCATION",
    ]

    def __init__(self, spacy_model: str = "en_core_web_sm", min_score_threshold: float = 0.6):
        """
        Initializes Presidio with explicit spaCy configuration and custom operator mappings.
        """
        self.min_score_threshold = min_score_threshold

        # 1. Configure the NLP engine explicitly with spaCy
        nlp_config = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": spacy_model}],
        }
        provider = NlpEngineProvider(nlp_configuration=nlp_config)
        nlp_engine = provider.create_engine()

        # 2. Instantiate Analyzer and Anonymizer Engines
        self.analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
        self.anonymizer = AnonymizerEngine()

        # 3. Define standardized replacement tags for each entity
        self.operators = {
            "PERSON": OperatorConfig("replace", {"new_value": "[CANDIDATE_NAME]"}),
            "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL_ADDRESS]"}),
            "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_NUMBER]"}),
            "LOCATION": OperatorConfig("replace", {"new_value": "[LOCATION]"}),
            # Default fallback for any other detected entity
            "DEFAULT": OperatorConfig("replace", {"new_value": "[REDACTED]"}),
        }

    def analyze(
        self,
        text: str,
        entities: Optional[List[str]] = None,
        score_threshold: Optional[float] = None
    ) -> List[RecognizerResult]:
        """
        Identifies PII bounding spans and confidence scores in the input text.
        """
        target_entities = entities or self.DEFAULT_ENTITIES
        threshold = score_threshold if score_threshold is not None else self.min_score_threshold

        results = self.analyzer.analyze(
            text=text,
            entities=target_entities,
            language="en",
            score_threshold=threshold,
        )
        return results

    def anonymize(
        self,
        text: str,
        entities: Optional[List[str]] = None,
        score_threshold: Optional[float] = None
    ) -> str:
        """
        Runs analysis and replaces matched PII spans with designated placeholder tokens.
        """
        if not text or not text.strip():
            return ""

        # Step 1: Detect entities
        analyzer_results = self.analyze(
            text=text,
            entities=entities,
            score_threshold=score_threshold
        )

        if not analyzer_results:
            return text

        # Step 2: Redact and replace
        anonymized_response: EngineResult = self.anonymizer.anonymize(
            text=text,
            analyzer_results=analyzer_results,
            operators=self.operators,
        )

        logger.debug(f"Redacted {len(analyzer_results)} PII occurrences.")
        return anonymized_response.text