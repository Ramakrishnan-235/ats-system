"""
employer_normalizer.py
Step 10: Lightweight Employer Normalization.

Cleans messy company names by stripping corporate legal suffixes (Inc, LLC, Ltd, GmbH, etc.)
and normalizing common tech employer aliases (e.g. 'Amazon Web Services' -> 'Amazon').
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("ats.parsers.employer_normalizer")

TOP_EMPLOYER_ALIASES = {
    # Tech Giants & Cloud
    "alphabet": "Google",
    "google": "Google",
    "google llc": "Google",
    "google inc": "Google",
    "meta": "Meta",
    "meta platforms": "Meta",
    "facebook": "Meta",
    "facebook inc": "Meta",
    "amazon": "Amazon",
    "amazon web services": "Amazon",
    "aws": "Amazon",
    "amazon.com": "Amazon",
    "microsoft": "Microsoft",
    "microsoft corporation": "Microsoft",
    "microsoft inc": "Microsoft",
    "apple": "Apple",
    "apple inc": "Apple",
    "apple computer": "Apple",
    "netflix": "Netflix",
    "netflix inc": "Netflix",
    "uber": "Uber",
    "uber technologies": "Uber",
    "airbnb": "Airbnb",
    "airbnb inc": "Airbnb",
    "stripe": "Stripe",
    "stripe inc": "Stripe",
    "salesforce": "Salesforce",
    "salesforce.com": "Salesforce",
    "salesforce inc": "Salesforce",
    "bytedance": "ByteDance",
    "bytedance ltd": "ByteDance",
    "tiktok": "ByteDance",
    "tesla": "Tesla",
    "tesla motors": "Tesla",
    "tesla inc": "Tesla",
    "oracle": "Oracle",
    "oracle corporation": "Oracle",
    "ibm": "IBM",
    "ibm corporation": "IBM",
    "cisco": "Cisco",
    "cisco systems": "Cisco",
    "intel": "Intel",
    "intel corporation": "Intel",
    "nvidia": "NVIDIA",
    "nvidia corporation": "NVIDIA",
    "adobe": "Adobe",
    "adobe inc": "Adobe",
    "spotify": "Spotify",
    "spotify ab": "Spotify",
    "shopify": "Shopify",
    "shopify inc": "Shopify",
    "databricks": "Databricks",
    "databricks inc": "Databricks",
    "snowflake": "Snowflake",
    "snowflake inc": "Snowflake",
    "palantir": "Palantir",
    "palantir technologies": "Palantir",
    "coinbase": "Coinbase",
    "coinbase global": "Coinbase",
    "linkedin": "LinkedIn",
    "linkedin corporation": "LinkedIn",
    "github": "GitHub",
    "github inc": "GitHub",
    "gitlab": "GitLab",
    "gitlab inc": "GitLab",
    "datadog": "Datadog",
    "datadog inc": "Datadog",
}


def normalize_employer(raw_name: Optional[str]) -> str:
    """
    Normalizes a company or employer name:
    1. Strips parenthetical annotations.
    2. Checks curated top employer alias map.
    3. Strips corporate legal suffixes (Inc, LLC, Ltd, Pvt Ltd, GmbH, etc.) and punctuation.
    4. Returns standardized clean title-cased company name.
    """
    if not raw_name or not isinstance(raw_name, str) or not raw_name.strip():
        return "Unknown Company"

    cleaned = raw_name.strip()
    # Strip parentheticals like (AWS) or (acquired by X)
    cleaned = re.sub(r"\s*\(.*?\)", "", cleaned).strip()

    lower_name = cleaned.lower().rstrip(".,")
    if lower_name in TOP_EMPLOYER_ALIASES:
        return TOP_EMPLOYER_ALIASES[lower_name]

    # Strip legal suffixes
    stripped = re.sub(
        r"(?i)\b(?:inc|llc|ltd|gmbh|corp|corporation|co|pvt|private|limited|llp|plc|pty|technologies|solutions|services|group)\b\.?",
        "",
        cleaned
    )
    # Strip dangling punctuation
    stripped = re.sub(r"[,\.;:\|\*•\-\/]+", " ", stripped)
    stripped = re.sub(r"\s+", " ", stripped).strip()

    if not stripped:
        return cleaned.title()

    if stripped.lower() in TOP_EMPLOYER_ALIASES:
        return TOP_EMPLOYER_ALIASES[stripped.lower()]

    if stripped.isupper() and len(stripped) <= 4:
        return stripped

    return stripped.title() if stripped.islower() else stripped
