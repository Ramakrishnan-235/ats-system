import logging
import re
from typing import Any

from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import EngineResult, OperatorConfig

logger = logging.getLogger("ats.parsers.anonymizer")

# Patterns for explicit identifiers that Presidio en_core_web_sm frequently misses
URL_PATTERN = re.compile(
    r"(?i)\b(?:https?://|www\.)[^\s<>'\"`]+|\b(?:[a-z0-9_-]+\.)*(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com)/[^\s<>'\"`]+",
    re.IGNORECASE,
)
EMAIL_PATTERN = re.compile(r"(?i)\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# Date ranges to protect against phone regex overmatching (e.g., 2019 - 2023)
DATE_RANGE_PATTERNS = [
    re.compile(r"\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|[Pp]resent|[Cc]urrent|[Nn]ow)\b"),
    re.compile(
        r"(?i)\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}[/.-])\s*(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}[/.-])\s*(?:19|20)\d{2}|present|current|now)\b"
    ),
    re.compile(r"\b\d{1,2}/\d{2,4}\s*(?:-|–|—|to)\s*(?:\d{1,2}/\d{2,4}|[Pp]resent|[Cc]urrent|[Nn]ow)\b"),
]

# Structural phone pattern requiring valid formatting/length
PHONE_STRUCTURAL_PATTERN = re.compile(
    r"(?i)(?:\b(?:phone|tel|mobile|cell)[:\s]*)?(?:\+\d{1,3}[-.\s]*)?(?:\(\d{2,4}\)|\b\d{2,4})[-.\s]*\d{3,4}[-.\s]*\d{3,4}\b"
)

NAME_DISQUALIFY_WORDS = {
    "candidate", "resume", "curriculum", "vitae", "profile", "summary",
    "engineer", "developer", "architect", "designer", "manager", "lead",
    "scientist", "analyst", "specialist", "consultant", "intern", "senior",
    "junior", "staff", "principal", "software", "backend", "frontend",
    "fullstack", "devops", "cloud", "data", "phone", "email", "mobile",
    "location", "contact", "education", "experience", "skills", "projects",
    "university", "college", "institute", "bachelor", "master", "phd",
}

# Statistical NER often labels these technologies as people or places. Known
# candidate identifiers are still scrubbed afterwards, even if a name collides.
TECHNICAL_ENTITY_TERMS = {
    "python", "java", "javascript", "typescript", "golang", "go", "rust",
    "react", "react native", "django", "flask", "fastapi", "angular", "vue",
    "node.js", "express.js", "kotlin", "scala", "swift", "perl", "ruby",
    "postgresql", "mysql", "mongodb", "neo4j", "sqlite", "redis", "docker",
    "kubernetes", "terraform", "kafka", "pytorch", "tensorflow", "pandas",
    "numpy", "linux", "git", "graphql", "grpc", "spring", "spring boot",
}
TECHNICAL_CONTEXT = re.compile(
    r"\b(?:using|built|develop\w*|programming|frameworks?|languages?|skills?|stack|tools?|"
    r"proficient|server|client|implemented|technolog\w*)\b", re.IGNORECASE,
)


def _technical_ner_span(text: str, result: RecognizerResult) -> bool:
    if result.entity_type not in {"PERSON", "LOCATION"}:
        return False
    if text[result.start:result.end].strip().casefold() not in TECHNICAL_ENTITY_TERMS:
        return False
    line_start = text.rfind("\n", 0, result.start) + 1
    line_end = text.find("\n", result.end)
    context = text[max(0, line_start - 60):line_end if line_end >= 0 else len(text)]
    return bool(TECHNICAL_CONTEXT.search(context))


import threading

_ANALYZER_CACHE: dict[str, AnalyzerEngine] = {}
_ANONYMIZER_CACHE: AnonymizerEngine | None = None
_CACHE_LOCK = threading.Lock()
_SHARED_ANONYMIZERS: dict[tuple[str, float], "ResumeAnonymizer"] = {}
_SHARED_LOCK = threading.Lock()


def get_shared_anonymizer(spacy_model: str = "en_core_web_sm", min_score_threshold: float = 0.55) -> "ResumeAnonymizer":
    """Returns a cached, shared ResumeAnonymizer instance avoiding duplicate allocations."""
    key = (spacy_model, min_score_threshold)
    with _SHARED_LOCK:
        if key not in _SHARED_ANONYMIZERS:
            _SHARED_ANONYMIZERS[key] = ResumeAnonymizer(spacy_model=spacy_model, min_score_threshold=min_score_threshold)
        return _SHARED_ANONYMIZERS[key]


class ResumeAnonymizer:
    """
    Sanitizes PII from resumes using deterministic parser-extracted metadata,
    specialized URL/regex sanitizers, and Microsoft Presidio with spaCy.
    Targets: PERSON, EMAIL_ADDRESS, PHONE_NUMBER, LOCATION, and URLs.
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
        Reuses cached NLP engine and analyzer instances to prevent reloading spaCy on every call.
        """
        self.min_score_threshold = min_score_threshold

        global _ANONYMIZER_CACHE
        if spacy_model not in _ANALYZER_CACHE or _ANONYMIZER_CACHE is None:
            with _CACHE_LOCK:
                if spacy_model not in _ANALYZER_CACHE:
                    nlp_config = {
                        "nlp_engine_name": "spacy",
                        "models": [
                            {
                                "lang_code": "en",
                                "model_name": spacy_model,
                                "ner_model_configuration": {
                                    "labels_to_ignore": [
                                        "CARDINAL",
                                        "MONEY",
                                        "PERCENT",
                                        "PRODUCT",
                                        "QUANTITY",
                                        "ORDINAL",
                                        "TIME",
                                        "LAW",
                                        "LANGUAGE",
                                        "EVENT",
                                    ]
                                },
                            }
                        ],
                    }
                    provider = NlpEngineProvider(nlp_configuration=nlp_config)
                    nlp_engine = provider.create_engine()
                    _ANALYZER_CACHE[spacy_model] = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])

                if _ANONYMIZER_CACHE is None:
                    _ANONYMIZER_CACHE = AnonymizerEngine()

        self.analyzer = _ANALYZER_CACHE[spacy_model]
        self.anonymizer = _ANONYMIZER_CACHE

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
        entities: list[str] | None = None,
        score_threshold: float | None = None
    ) -> list[RecognizerResult]:
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

    def _protect_and_redact_phones(self, text: str) -> str:
        """
        Redacts phone numbers without wiping employment date intervals like 2019 - 2023.
        """
        placeholders: dict[str, str] = {}
        counter = 0

        def stash_date(match: re.Match) -> str:
            nonlocal counter
            key = f"__DATE_INTERVAL_TOKEN_{counter}__"
            placeholders[key] = match.group(0)
            counter += 1
            return key

        # 1. Stash date ranges
        protected_text = text
        for pat in DATE_RANGE_PATTERNS:
            protected_text = pat.sub(stash_date, protected_text)

        # 2. Redact phone numbers
        redacted = PHONE_STRUCTURAL_PATTERN.sub("[PHONE_NUMBER]", protected_text)

        # 3. Restore date ranges
        for key, orig in placeholders.items():
            redacted = redacted.replace(key, orig)

        return redacted

    def redact_known_identifiers(
        self,
        text: str,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        urls: list[str] | None = None,
        extra_identifiers: list[str] | None = None,
    ) -> str:
        """
        Explicitly scrubs known entities extracted by the parser (name, email, phone, location, URLs).
        This guarantees recall even when statistical NER models miss names or multi-cultural naming formats.
        """
        if not text:
            return ""

        # Remove complete identifiers before replacing name tokens inside them
        # (for example Alice in alice@example.test or a profile URL).
        redacted = EMAIL_PATTERN.sub("[EMAIL_ADDRESS]", text)
        if email and email.strip() and email.strip().upper() != "N/A":
            redacted = re.sub(re.escape(email.strip()), "[EMAIL_ADDRESS]", redacted, flags=re.IGNORECASE)
        redacted = URL_PATTERN.sub("[PROFILE_URL]", redacted)

        # 1. Scrub candidate name (full name and distinct name tokens)
        if name and name.strip() and name.strip().lower() != "candidate":
            clean_name = name.strip()
            # Full name replacement
            redacted = re.sub(rf"(?i)\b{re.escape(clean_name)}\b", "[CANDIDATE_NAME]", redacted)
            # Individual word tokens (length >= 3, skipping noise words)
            for word in clean_name.split():
                w = word.strip()
                if len(w) >= 3 and w.lower() not in NAME_DISQUALIFY_WORDS:
                    redacted = re.sub(rf"(?i)\b{re.escape(w)}\b", "[CANDIDATE_NAME]", redacted)

        # 2. Scrub email
        if email and email.strip() and email.strip().upper() != "N/A":
            redacted = re.sub(rf"(?i)\b{re.escape(email.strip())}\b", "[EMAIL_ADDRESS]", redacted)
        # Scrub all other emails
        redacted = EMAIL_PATTERN.sub("[EMAIL_ADDRESS]", redacted)

        # 3. Scrub phone
        if phone and phone.strip() and phone.strip().upper() != "N/A":
            clean_phone = phone.strip()
            redacted = re.sub(rf"(?i)(?<!\w){re.escape(clean_phone)}(?!\w)", "[PHONE_NUMBER]", redacted)
            # Digits-only phone if len >= 7
            digits = re.sub(r"\D", "", phone)
            if len(digits) >= 7:
                # Protect date collisions before replacing
                if not (len(digits) == 4 and digits[:2] in ("19", "20")):
                    redacted = re.sub(rf"\b{re.escape(digits)}\b", "[PHONE_NUMBER]", redacted)
        # Protect dates and redact structural phone numbers
        redacted = self._protect_and_redact_phones(redacted)

        # 4. Scrub known URLs & all web/social profile links (LinkedIn, GitHub, GitLab, etc.)
        if urls:
            for u in urls:
                if u and str(u).strip() and str(u).strip().upper() != "N/A":
                    clean_u = str(u).strip()
                    redacted = re.sub(rf"(?i){re.escape(clean_u)}", "[PROFILE_URL]", redacted)
        redacted = URL_PATTERN.sub("[PROFILE_URL]", redacted)

        # 5. Scrub location
        if location and location.strip() and location.strip().upper() not in {"N/A", "REMOTE"}:
            loc_str = location.strip()
            if len(loc_str) >= 3:
                redacted = re.sub(rf"(?i)\b{re.escape(loc_str)}\b", "[LOCATION]", redacted)
                # If comma-separated, redact city/state segments
                for part in loc_str.split(","):
                    p = part.strip()
                    if len(p) >= 3 and p.lower() not in {"remote", "india", "usa", "united states", "canada"}:
                        redacted = re.sub(rf"(?i)\b{re.escape(p)}\b", "[LOCATION]", redacted)

        # 6. Scrub extra identifiers
        if extra_identifiers:
            for item in extra_identifiers:
                if item and str(item).strip():
                    redacted = re.sub(rf"(?i)\b{re.escape(str(item).strip())}\b", "[REDACTED]", redacted)

        return redacted

    def check_preflight_leak(
        self,
        text: str,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        urls: list[str] | None = None,
    ) -> tuple[bool, list[str]]:
        """
        Validates that no candidate PII leaks into the text before transmission to an external LLM (e.g. OpenRouter).
        Returns (is_clean, leaked_fields).
        """
        leaks: list[str] = []
        if not text:
            return True, []

        # Check name
        if name and name.strip() and name.strip().lower() != "candidate":
            for word in name.strip().split():
                w = word.strip()
                if len(w) >= 3 and w.lower() not in NAME_DISQUALIFY_WORDS:
                    if re.search(rf"(?i)\b{re.escape(w)}\b", text):
                        leaks.append(f"name:{w}")
                        break

        # Check email
        if email and email.strip() and email.strip().upper() != "N/A":
            if re.search(rf"(?i){re.escape(email.strip())}", text):
                leaks.append("email")
        if EMAIL_PATTERN.search(text):
            leaks.append("email_pattern")

        # Check phone
        if phone and phone.strip() and phone.strip().upper() != "N/A":
            if re.search(rf"(?i){re.escape(phone.strip())}", text):
                leaks.append("phone")

        # Check URLs
        if urls:
            for u in urls:
                if u and str(u).strip() and str(u).strip().upper() != "N/A":
                    clean_u = str(u).strip()
                    if clean_u in text:
                        leaks.append("profile_url")
                        break
        if URL_PATTERN.search(text):
            leaks.append("unredacted_url")

        return len(leaks) == 0, leaks

    def scrub_residual_pii(
        self,
        text: str,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        urls: list[str] | None = None,
    ) -> str:
        """
        Aggressively scrubs any remaining residual personal identifiers.
        """
        return self.redact_known_identifiers(
            text=text,
            name=name,
            email=email,
            phone=phone,
            location=location,
            urls=urls,
        )

    def anonymize(
        self,
        text: str,
        entities: list[str] | None = None,
        score_threshold: float | None = None,
        known_entities: dict[str, Any] | None = None,
        known_name: str | None = None,
        known_email: str | None = None,
        known_phone: str | None = None,
        known_location: str | None = None,
        known_urls: list[str] | None = None,
        extra_identifiers: list[str] | None = None,
    ) -> str:
        """
        Runs complete multi-stage anonymization:
        1. Explicit redaction of parser-extracted known candidate identifiers (name, email, phone, URLs).
        2. Presidio NLP analysis & anonymization for prose entities.
        3. Deterministic URL & residual leak scrub.
        """
        if not text or not text.strip():
            return ""

        # Extract known entities from dict if passed
        ke = known_entities or {}
        name = known_name or ke.get("name")
        email = known_email or ke.get("email")
        phone = known_phone or ke.get("phone")
        location = known_location or ke.get("location")
        urls = list(known_urls or ke.get("urls") or [])
        if ke.get("linkedin") and ke.get("linkedin") not in urls:
            urls.append(ke.get("linkedin"))

        # Step 1: Presidio analysis and anonymization on raw prose
        analyzer_results = self.analyze(
            text=text,
            entities=entities,
            score_threshold=score_threshold
        )
        analyzer_results = [
            result for result in analyzer_results
            if not _technical_ner_span(text, result)
        ]

        presidio_text = text
        if analyzer_results:
            anonymized_response: EngineResult = self.anonymizer.anonymize(
                text=text,
                analyzer_results=analyzer_results,
                operators=self.operators,
            )
            presidio_text = anonymized_response.text

        # Step 2: Deterministic scrubbing of parser-extracted entities, URLs, and phone numbers with date protection
        final_text = self.redact_known_identifiers(
            text=presidio_text,
            name=name,
            email=email,
            phone=phone,
            location=location,
            urls=urls,
            extra_identifiers=extra_identifiers,
        )

        # Step 3: Clean up any double-bracket anomalies if any occurred
        final_text = re.sub(r"\[\[([A-Z_]+)\]\]", r"[\1]", final_text)

        logger.debug("Successfully sanitized resume text with known identifiers and Presidio.")
        return final_text
