"""
section_anchor.py
Deterministic, Code-Only Section Anchoring Engine.

Determines the exact section ('header', 'summary', 'experience', 'education', 'skills', 
'projects', 'certifications', etc.) and experience entry boundary (entry_idx) for every line 
of resume text using deterministic pattern matching and date-range boundary detection.
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Set

# Comprehensive canonical section headers mapping
SECTION_HEADERS: Dict[str, List[str]] = {
    "summary": [
        "summary",
        "professional summary",
        "executive summary",
        "profile",
        "professional profile",
        "career summary",
        "objective",
        "career objective",
        "about me",
        "about",
        "overview",
        "bio",
        "personal statement",
    ],
    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment",
        "employment history",
        "work history",
        "professional background",
        "career history",
        "relevant experience",
        "industry experience",
        "technical experience",
        "practical experience",
        "internships",
        "internship experience",
    ],
    "education": [
        "education",
        "education and training",
        "academic background",
        "academics",
        "educational qualifications",
        "academic history",
        "degrees",
        "qualifications",
        "university",
        "college",
    ],
    "skills": [
        "skills",
        "technical skills",
        "core competencies",
        "technologies",
        "tech stack",
        "skills and tools",
        "competencies",
        "technical proficiencies",
        "skills & proficiencies",
        "key skills",
        "areas of expertise",
        "programming skills",
        "tools & technologies",
        "hard skills",
        "software skills",
    ],
    "projects": [
        "projects",
        "personal projects",
        "selected projects",
        "side projects",
        "key projects",
        "academic projects",
        "software projects",
        "technical projects",
        "portfolio projects",
        "featured projects",
    ],
    "certifications": [
        "certifications",
        "certificates",
        "licenses",
        "certifications and training",
        "licenses & certifications",
        "credentials",
        "courses & certifications",
    ],
    "awards": [
        "awards",
        "honors",
        "honors & awards",
        "achievements",
        "key achievements",
        "recognition",
    ],
    "publications": [
        "publications",
        "research",
        "papers",
        "patents",
        "presentations",
    ],
    "volunteer": [
        "volunteer",
        "volunteering",
        "volunteer experience",
        "community involvement",
        "extracurricular activities",
    ],
}

# Reverse lookup table: normalized header string -> section name
HEADER_LOOKUP: Dict[str, str] = {
    variant: section
    for section, variants in SECTION_HEADERS.items()
    for variant in variants
}

# A line containing a date RANGE marks the start / boundary of an experience entry
DATE_RANGE_RE = re.compile(
    r"(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:(?:19|20)\d{2}|present|current|now|till date|to date)"
    r"|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(?:'?\d{2,4})?\s*(?:–|—|-|to)\s*"
    r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}|present|current|now|till date|to date)"
    r"|\b\d{1,2}/(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:\d{1,2}/(?:19|20)\d{2}|present|current|now)"
    r"|\b(?:spring|summer|fall|autumn|winter)\s*(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:(?:spring|summer|fall|autumn|winter)\s*(?:19|20)\d{2}|present|current)",
    re.IGNORECASE,
)

# Single dates for graduation or project checkpoints
SINGLE_DATE_RE = re.compile(
    r"\b(?:19|20)\d{2}\b"
    r"|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\b",
    re.IGNORECASE,
)


def anchor_sections(text: str) -> Tuple[List[str], List[Tuple[str, Optional[int]]]]:
    """
    Scans raw resume text line-by-line and returns a parallel tuple:
    - lines: List[str] of original text lines
    - anchors: List[Tuple[section_name, entry_index_or_None]]

    The trick: date-range lines in the 'experience' section delineate entry boundaries.
    When a line in the experience section matches a date range (e.g. 'Jan 2020 – Present'),
    a new entry index is started, and every subsequent line belongs to that job entry
    until the next date range is encountered.
    """
    if not text:
        return [], []

    lines = text.split("\n")
    anchors: List[Tuple[str, Optional[int]]] = []
    section = "header"
    entry_idx: Optional[int] = None

    for line in lines:
        raw_stripped = line.strip()
        
        # Clean markdown headers (#, ##), bullet points, colons, and dashes
        norm = re.sub(r"^[#\*\_\•\-\–\—\s]+", "", raw_stripped)
        norm = re.sub(r"[:\*\_\#\s]+$", "", norm).strip().lower()

        # Check for section header change
        if len(norm) < 40 and norm in HEADER_LOOKUP:
            section = HEADER_LOOKUP[norm]
            entry_idx = None
        elif section == "experience":
            # Check if this line marks a new job entry via a date range
            if DATE_RANGE_RE.search(line):
                entry_idx = 1 if entry_idx is None else entry_idx + 1
        elif section == "projects":
            # In projects section, detect new project entries via date range or bulleted project titles
            if DATE_RANGE_RE.search(line):
                entry_idx = 1 if entry_idx is None else entry_idx + 1

        anchors.append((section, entry_idx))

    return lines, anchors


def get_section_text(lines: List[str], anchors: List[Tuple[str, Optional[int]]], target_section: str) -> str:
    """
    Extracts concatenated text lines belonging to a specific section.
    """
    matching_lines = [
        line for line, (sec, _) in zip(lines, anchors)
        if sec == target_section
    ]
    return "\n".join(matching_lines).strip()


def get_section_lines(
    lines: List[str],
    anchors: List[Tuple[str, Optional[int]]],
    target_section: str,
    target_entry: Optional[int] = None
) -> List[str]:
    """
    Returns lines belonging to a specific section and optional entry index.
    """
    result = []
    for line, (sec, idx) in zip(lines, anchors):
        if sec == target_section:
            if target_entry is None or idx == target_entry:
                result.append(line)
    return result


def extract_structured_experience_entries(
    lines: List[str],
    anchors: List[Tuple[str, Optional[int]]]
) -> List[Dict[str, Any]]:
    """
    Deterministic extraction of experience entries from anchored lines.
    Groups lines by entry_index and extracts:
    - entry_index: int
    - raw_text: str
    - date_range: Optional[str]
    - bullets: List[str]
    """
    entries_map: Dict[int, List[str]] = {}
    
    # Fallback bucket if experience section has lines before the first date range
    pre_entry_lines: List[str] = []

    for line, (sec, idx) in zip(lines, anchors):
        if sec == "experience":
            clean_l = line.strip()
            if not clean_l:
                continue
            if idx is not None:
                if idx not in entries_map:
                    entries_map[idx] = []
                entries_map[idx].append(line)
            else:
                pre_entry_lines.append(line)

    # If no date ranges were found but lines exist in experience section, group as entry 1
    if not entries_map and pre_entry_lines:
        entries_map[1] = pre_entry_lines
    elif pre_entry_lines and 1 in entries_map:
        # Prepend pre-entry lines (e.g. Title / Company before date line) to entry 1
        entries_map[1] = pre_entry_lines + entries_map[1]

    results: List[Dict[str, Any]] = []
    for idx in sorted(entries_map.keys()):
        entry_lines = entries_map[idx]
        entry_text = "\n".join(entry_lines)
        
        # Find date range string
        date_match = DATE_RANGE_RE.search(entry_text)
        date_range_str = date_match.group(0).strip() if date_match else None

        # Extract bullets (lines starting with •, -, *, or numbered)
        bullets = []
        for l in entry_lines:
            strip_l = l.strip()
            if re.match(r"^[\•\-\*\—\–]\s*", strip_l) or re.match(r"^\d+\.\s+", strip_l):
                clean_bullet = re.sub(r"^[\•\-\*\—\–\d\.]+\s*", "", strip_l).strip()
                if clean_bullet:
                    bullets.append(clean_bullet)

        results.append({
            "entry_index": idx,
            "raw_text": entry_text,
            "date_range": date_range_str,
            "bullets": bullets,
            "line_count": len(entry_lines),
        })

    return results


def anchor_skill_mentions(
    text: str,
    skills: List[str]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Maps each skill to its exact section anchors and experience entry contexts.
    Returns: Dict[skill_name -> List of evidence locations:
        {
            "section": "experience" | "skills" | "projects" | "education" | "summary",
            "entry_index": int or None,
            "line_number": int,
            "line_text": str,
            "evidence_weight": 1.0 (experience) | 0.8 (projects) | 0.5 (skills list) | 0.3 (education)
        }
    ]
    """
    lines, anchors = anchor_sections(text)
    evidence_by_skill: Dict[str, List[Dict[str, Any]]] = {s: [] for s in skills}

    SECTION_WEIGHTS = {
        "experience": 1.0,    # Production usage evidence
        "projects": 0.8,      # Practical application evidence
        "summary": 0.6,       # Stated core competency
        "skills": 0.5,        # Keyword list mention
        "certifications": 0.5,# Certified proficiency
        "education": 0.3,     # Academic coursework
        "header": 0.2,
    }

    for line_no, (line, (sec, idx)) in enumerate(zip(lines, anchors), start=1):
        line_clean = line.strip()
        if not line_clean:
            continue

        line_lower = f" {line_clean.lower()} "

        for skill in skills:
            skill_token = skill.strip().lower()
            if not skill_token:
                continue

            # Check boundary match
            pattern = r"(?<!\w)" + re.escape(skill_token) + r"(?!\w)"
            if re.search(pattern, line_lower):
                weight = SECTION_WEIGHTS.get(sec, 0.4)
                evidence_by_skill[skill].append({
                    "section": sec,
                    "entry_index": idx,
                    "line_number": line_no,
                    "line_text": line_clean,
                    "evidence_weight": weight,
                })

    return evidence_by_skill
