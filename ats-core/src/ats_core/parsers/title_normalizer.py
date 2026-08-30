"""
title_normalizer.py
Step 9: Title Normalization & Seniority (Parallel Mini-Pipeline).

Normalizes messy resume job titles into structured dimensions:
1. Seniority level: exec, vp, director, manager, staff, lead, senior, mid, junior.
2. Management flag: True if title entails management/executive oversight.
3. Canonical Function: Normalized O*NET-aligned job function (e.g. 'Software Engineer', 'DevOps Engineer').
4. Career Trajectory: Computes seniority velocity and promotion history across timeline.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from rapidfuzz import process, fuzz

logger = logging.getLogger("ats.parsers.title_normalizer")

SENIORITY_PATTERNS: List[Tuple[str, str]] = [
    # Ordered highest -> lowest; first match wins
    (r"\b(?:chief|cto|ceo|cfo|coo|cpo|ciso|cio)\b", "exec"),
    (r"\b(?:vp|vice\s+president|svp|evp|avp)\b", "vp"),
    (r"\b(?:director|head\s+of)\b", "director"),
    (r"\b(?:engineering\s+manager|dev\s+manager|technical\s+manager|manager|mgr|team\s+lead)\b", "manager"),
    (r"\b(?:distinguished|fellow|principal|staff)\b", "staff"),
    (r"\b(?:tech\s+lead|technical\s+lead|lead|architect)\b", "lead"),
    (r"\b(?:senior|snr|sr\.?|lead)\b", "senior"),
    (r"\b(?:junior|jr\.?|intern|internship|trainee|graduate|entry[- ]level|associate|apprentice)\b", "junior"),
]

ROMAN_LEVELS: Dict[str, str] = {
    "i": "junior",
    "ii": "mid",
    "iii": "senior",
    "iv": "staff",
    "v": "staff",
}

NUMERIC_LEVELS: Dict[str, str] = {
    "1": "junior",
    "2": "mid",
    "3": "senior",
    "4": "staff",
    "5": "staff",
}

TITLE_ABBREVIATIONS: Dict[str, str] = {
    "sde": "software engineer",
    "swe": "software engineer",
    "sse": "senior software engineer",
    "mts": "member of technical staff",
    "smts": "senior member of technical staff",
    "fe": "frontend developer",
    "be": "backend developer",
    "fs": "full stack developer",
    "qa": "qa engineer",
    "qae": "qa engineer",
    "sdet": "software development engineer in test",
    "dba": "database administrator",
    "sre": "site reliability engineer",
    "mle": "machine learning engineer",
    "ml eng": "machine learning engineer",
    "devops": "devops engineer",
    "ai eng": "ai engineer",
    "pm": "product manager",
    "tpm": "technical product manager",
    "em": "engineering manager",
    "ds": "data scientist",
    "de": "data engineer",
}

# Standard O*NET-aligned canonical functions
CANONICAL_FUNCTIONS: List[str] = [
    "Software Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Engineer",
    "Mobile Engineer",
    "iOS Developer",
    "Android Developer",
    "DevOps Engineer",
    "Site Reliability Engineer",
    "Cloud Architect",
    "Systems Engineer",
    "Embedded Software Engineer",
    "Firmware Engineer",
    "Data Engineer",
    "Data Scientist",
    "Machine Learning Engineer",
    "AI Research Engineer",
    "Deep Learning Engineer",
    "Computer Vision Engineer",
    "NLP Engineer",
    "Security Engineer",
    "Application Security Engineer",
    "QA Engineer",
    "Automation Test Engineer",
    "Database Administrator",
    "Product Manager",
    "Technical Program Manager",
    "Engineering Manager",
    "Solutions Architect",
    "UI/UX Designer",
    "Product Designer",
]

SENIORITY_RANKS: Dict[str, int] = {
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "lead": 4,
    "staff": 5,
    "manager": 5,
    "director": 6,
    "vp": 7,
    "exec": 8,
}


def canonicalize_function(raw_func: str, score_cutoff: float = 75.0) -> str:
    """
    Matches the stripped function string against canonical O*NET technical functions
    using RapidFuzz token set ratio.
    """
    if not raw_func or not raw_func.strip():
        return "Software Engineer"

    clean = raw_func.strip().lower()

    # Expand any compound abbreviation phrases (e.g. "ml eng", "ai eng", "qa eng")
    for abbr, expanded in TITLE_ABBREVIATIONS.items():
        if abbr in clean:
            clean = re.sub(r"\b" + re.escape(abbr) + r"\b", expanded, clean)

    # Direct word checks for common variants
    if "full stack" in clean or "fullstack" in clean:
        return "Full Stack Engineer"
    if "backend" in clean or "back end" in clean or "back-end" in clean:
        return "Backend Engineer"
    if "frontend" in clean or "front end" in clean or "front-end" in clean:
        return "Frontend Engineer"
    if "devops" in clean or "ci/cd" in clean or "infrastructure" in clean:
        return "DevOps Engineer"
    if "site reliability" in clean or "sre" in clean:
        return "Site Reliability Engineer"
    if "data engineer" in clean:
        return "Data Engineer"
    if "machine learning" in clean or "mle" in clean:
        return "Machine Learning Engineer"
    if "data scientist" in clean:
        return "Data Scientist"
    if "qa" in clean or "quality assurance" in clean or "test engineer" in clean or "sdet" in clean:
        return "QA Engineer"
    if "security" in clean or "appsec" in clean:
        return "Security Engineer"
    if "mobile" in clean or "ios" in clean or "android" in clean:
        return "Mobile Engineer"
    if "product manager" in clean:
        return "Product Manager"
    if "architect" in clean:
        return "Solutions Architect"

    match = process.extractOne(
        clean,
        CANONICAL_FUNCTIONS,
        scorer=fuzz.token_set_ratio,
        score_cutoff=score_cutoff
    )
    if match:
        return match[0]

    return clean.title()


def parse_title(raw: Optional[str]) -> Dict[str, Any]:
    """
    Parses a raw job title into structured components:
    - seniority: exec | vp | director | manager | staff | lead | senior | mid | junior
    - is_management: boolean flag
    - function: canonical O*NET technical function
    - confidence: low | medium | high
    """
    if not raw or not isinstance(raw, str) or not raw.strip():
        return {
            "raw": "N/A",
            "seniority": "mid",
            "is_management": False,
            "function": "Software Engineer",
            "confidence": "low",
        }

    raw_clean = raw.strip()
    words = raw_clean.lower().split()
    expanded_words = [TITLE_ABBREVIATIONS.get(w.strip(".,/"), w) for w in words]
    expanded_title = " ".join(expanded_words)

    # 1. Detect Seniority Level
    seniority = "mid"  # default
    for pattern, level in SENIORITY_PATTERNS:
        if re.search(pattern, expanded_title, re.IGNORECASE):
            seniority = level
            break

    # 2. Check Roman Numeral / Digit levels if still mid
    if seniority == "mid":
        roman = re.search(r"\b(i|ii|iii|iv|v)\b", expanded_title, re.IGNORECASE)
        if roman and roman.group(1).lower() in ROMAN_LEVELS:
            seniority = ROMAN_LEVELS[roman.group(1).lower()]
        else:
            num = re.search(r"\b(?:level|l|tier)?\s*([1-5])\b", expanded_title, re.IGNORECASE)
            if num and num.group(1) in NUMERIC_LEVELS:
                seniority = NUMERIC_LEVELS[num.group(1)]

    # 3. Detect Management Flag
    is_management = seniority in ("exec", "vp", "director", "manager") or bool(
        re.search(r"\b(?:lead|manager|head|director|chief|vp)\b", expanded_title, re.IGNORECASE)
    )

    # 4. Strip Seniority Keywords to isolate the core technical function
    func_text = expanded_title
    for pat, _ in SENIORITY_PATTERNS:
        func_text = re.sub(pat, "", func_text, flags=re.IGNORECASE)
    func_text = re.sub(r"\b(i|ii|iii|iv|v|[1-5])\b", "", func_text, flags=re.IGNORECASE).strip()
    func_text = re.sub(r"\s+", " ", func_text).strip()

    canonical_func = canonicalize_function(func_text)

    return {
        "raw": raw_clean,
        "seniority": seniority,
        "is_management": is_management,
        "function": canonical_func,
        "confidence": "high" if seniority != "mid" else "medium",
    }


def calculate_title_trajectory(experience_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes title trajectory across a candidate's career history (ordered latest -> earliest
    or earliest -> latest).
    Computes:
    - parsed_titles: list of parsed title objects
    - current_seniority: highest / latest seniority level
    - max_seniority: peak seniority attained
    - trajectory_type: 'accelerating' | 'progressing' | 'stable' | 'early_career'
    - promotions_count: number of promotions detected
    - meets_senior_requirement: True if candidate attained senior, lead, staff, or exec level
    """
    if not experience_entries:
        return {
            "current_seniority": "mid",
            "max_seniority": "mid",
            "trajectory_type": "early_career",
            "promotions_count": 0,
            "meets_senior_requirement": False,
            "parsed_titles": [],
        }

    parsed = []
    for exp in experience_entries:
        raw_role = exp.get("role") or exp.get("job_title") or exp.get("title") or ""
        parsed_role = parse_title(raw_role)
        parsed.append(parsed_role)

    # Calculate seniority sequence
    ranks = [SENIORITY_RANKS.get(p["seniority"], 2) for p in parsed]
    
    # In resumes, entry 0 is typically latest / current role
    current_rank = ranks[0]
    current_seniority = parsed[0]["seniority"]
    max_rank = max(ranks)
    max_seniority = max(parsed, key=lambda p: SENIORITY_RANKS.get(p["seniority"], 2))["seniority"]

    # If sorted latest -> earliest, reverse for chronological analysis
    chronological_ranks = list(reversed(ranks))
    promotions = 0
    for i in range(1, len(chronological_ranks)):
        if chronological_ranks[i] > chronological_ranks[i - 1]:
            promotions += 1

    if promotions >= 2 or current_rank >= 5:
        trajectory_type = "accelerating"
    elif promotions >= 1 or current_rank >= 3:
        trajectory_type = "progressing"
    elif current_rank == 1:
        trajectory_type = "early_career"
    else:
        trajectory_type = "stable"

    meets_senior = max_rank >= SENIORITY_RANKS["senior"]

    return {
        "current_seniority": current_seniority,
        "max_seniority": max_seniority,
        "trajectory_type": trajectory_type,
        "promotions_count": promotions,
        "meets_senior_requirement": meets_senior,
        "parsed_titles": parsed,
    }
