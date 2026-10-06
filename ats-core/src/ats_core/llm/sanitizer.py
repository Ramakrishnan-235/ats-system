import re
from typing import Optional, List, Collection

# Compiled regex patterns for prompt injection defenses

CONTROL_TOKENS_PATTERN = re.compile(
    r"(<\|[^>]*\|>|\[/?INST\]|<<?/?SYS>>?|\[/?SYS\]|</?s>|</?turn>|</?start_of_turn>|</?end_of_turn>|<human>|<bot>|\[/?HUMAN\]|\[/?AI\])",
    re.IGNORECASE,
)

ADVERSARIAL_DIRECTIVES_PATTERN = re.compile(
    r"(?i)\b("
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions|"
    r"system\s+prompt\s+override|"
    r"disregard\s+(the\s+above|all\s+rules|previous\s+instructions)|"
    r"new\s+system\s+prompt|"
    r"reveal\s+(system\s+prompt|all\s+instructions)|"
    r"output\s+score\s+100|"
    r"you\s+are\s+now\s+(an?\s+)?(unrestricted|evaluator|assistant)|"
    r"bypass\s+all\s+(rules|restrictions)"
    r")\b"
)

ROLE_DELIMITER_PATTERN = re.compile(
    r"(?im)(?:^|\b)(system|assistant|user|human|evaluator|admin|developer|instruction)\s*:",
)

# Neutralizes XML boundary breakout tags across all LLM prompt templates:
# - untrusted_candidate_dossier (deep_evaluator, llm_evaluator)
# - job_requisition (deep_evaluator, llm_evaluator)
# - untrusted_resume_content (ollama_extractor)
# - resume_text (llm_residue_extractor)
# - skills_already_found (llm_residue_extractor)
# - candidate_profile
# - any untrusted_* prefix tag
DEFAULT_XML_TAG_ESCAPE_PATTERN = re.compile(
    r"<\/?(untrusted_[a-zA-Z0-9_-]+|job_requisition|resume_text|skills_already_found|candidate_profile|system_instruction)[^>]*>",
    re.IGNORECASE,
)


def sanitize_prompt_text(text: str, extra_tags: Optional[Collection[str]] = None) -> str:
    """
    Robustly sanitizes untrusted candidate resumes and job inputs before interpolation into LLM prompts:
    1. Neutralizes triple-backtick markdown breakout sequences (``` -> ''').
    2. Neutralizes structural XML enclosure tags to prevent prompt escaping (case-insensitive).
    3. Strips LLM chat control tokens (<|im_start|>, [INST], <<SYS>>, <turn>, etc.) case-insensitively.
    4. Neutralizes fake conversational system/assistant/admin role prefixes case-insensitively.
    5. Defangs explicit jailbreak directives (ignore previous instructions, override system prompt, etc.).
    """
    if not text:
        return ""

    # 1. Neutralize triple-backticks
    sanitized = text.replace("```", "'''")

    # 2. Prevent boundary breakout from enclosing XML tags
    sanitized = DEFAULT_XML_TAG_ESCAPE_PATTERN.sub("[escaped_tag]", sanitized)
    if extra_tags:
        escaped_extra = "|".join(re.escape(tag.strip("<>/")) for tag in extra_tags if tag.strip("<>/"))
        if escaped_extra:
            custom_xml_pat = re.compile(rf"<\/?(?:{escaped_extra})[^>]*>", re.IGNORECASE)
            sanitized = custom_xml_pat.sub("[escaped_tag]", sanitized)

    # 3. Strip LLM control sequences
    sanitized = CONTROL_TOKENS_PATTERN.sub("", sanitized)

    # 4. Neutralize fake role prefixes (case-insensitive, multiline)
    sanitized = ROLE_DELIMITER_PATTERN.sub("Applicant text:", sanitized)

    # 5. Defang jailbreak override directives
    sanitized = ADVERSARIAL_DIRECTIVES_PATTERN.sub("[neutralized_directive]", sanitized)

    return sanitized.strip()


class PromptSanitizer:
    """
    Centralized prompt sanitizer for all ATS LLM extractors and evaluators.
    """

    CONTROL_TOKENS_PATTERN = CONTROL_TOKENS_PATTERN
    ADVERSARIAL_DIRECTIVES_PATTERN = ADVERSARIAL_DIRECTIVES_PATTERN
    ROLE_DELIMITER_PATTERN = ROLE_DELIMITER_PATTERN
    XML_TAG_ESCAPE_PATTERN = DEFAULT_XML_TAG_ESCAPE_PATTERN

    @classmethod
    def sanitize(cls, text: str, extra_tags: Optional[Collection[str]] = None) -> str:
        return sanitize_prompt_text(text, extra_tags=extra_tags)
