"""Shared handling of service-inserted privacy markers in resume evidence."""

import re

PRIVACY_MARKERS = re.compile(
    r"\[(?:CANDIDATE_NAME|EMAIL_ADDRESS|PHONE_NUMBER|LOCATION|PROFILE_URL|REDACTED)\]"
)


def strip_privacy_markers(text: str) -> str:
    return PRIVACY_MARKERS.sub("", text)


def normalize_for_grounding(text: str) -> str:
    return " ".join(strip_privacy_markers(text).split())


def is_grounded_quote(quote: str, source: str) -> bool:
    """Accept quotes across privacy markers, never a marker-only quote."""
    normalized_quote = normalize_for_grounding(quote)
    return bool(normalized_quote) and normalized_quote in normalize_for_grounding(source)
