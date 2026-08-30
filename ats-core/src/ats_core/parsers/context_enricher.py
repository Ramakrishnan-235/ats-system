"""
context_enricher.py
Step 7: Context Enrichment (Where Keyword Extraction Becomes Entity Recognition).

Fuses Gazetteer match spans with Section Anchoring and structured timeline dates to transform
raw skill keywords into rich, verifiable skill entities with:
1. Evidence tier classification (skills_bar, summary, education, contextual, demonstrated, demonstrated_impact).
2. Action verb and business/technical metric detection.
3. Structured date inheritance from experience entries for recency scoring.
4. Independent 'is_certified' dimension tracking for certifications.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime

from ats_core.parsers.section_anchor import anchor_sections, DATE_RANGE_RE
from ats_core.parsers.skill_matcher import SkillMatcher
from ats_core.parsers.normalizers import normalize_date

logger = logging.getLogger("ats.parsers.context_enricher")

# Tunable evidence weights calibrated for production ATS evaluation
EVIDENCE_WEIGHTS: Dict[str, float] = {
    "skills_bar": 1.0,           # Claimed in skills list
    "summary": 0.8,              # Claimed in bio / summary
    "education": 0.6,            # Coursework exposure
    "contextual": 1.3,           # Mentioned in work history without action verb
    "demonstrated": 1.6,         # Applied action verb present ("built", "led", "migrated")
    "demonstrated_impact": 1.8,  # Action verb + measurable metric ("reduced latency 40%")
    "certified": 1.0,            # Certified credential (tracked in is_certified boolean)
}

ACTION_VERB_RE = re.compile(
    r"\b(?:built|designed|developed|implemented|led|migrated|optimized|architected"
    r"|engineered|deployed|automated|reduced|increased|scaled|shipped|refactored"
    r"|created|launched|delivered|maintained|spearheaded|authored|orchestrated"
    r"|constructed|profiled|accelerated|trained|fine-tuned|finetuned|evaluated)\b",
    re.IGNORECASE,
)

METRIC_RE = re.compile(
    r"\d+(?:\.\d+)?\s*%|\$\s?\d+(?:\.\d+)?(?:\s*[kmbt]|million|billion|thousand)?"
    r"|\b\d+x\b|\b\d+\s*(?:k|m|million|thousand|users|customers|requests|qps|rps|ms|tb|gb|mb|nodes|servers|models|endpoints|queries|req/s)\b"
    r"|\b(?:reduced|improved|increased|decreased|accelerated|cut)\b[^\.\n]{1,40}\b\d+",
    re.IGNORECASE,
)

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?\n])\s+|[\•\*\-]\s+")


def split_into_sentences(text: str) -> List[str]:
    """Splits a multi-line or bulleted text block into individual sentences."""
    if not text:
        return []
    raw_splits = SENTENCE_SPLIT_RE.split(text)
    return [s.strip().strip("•-* ") for s in raw_splits if s.strip() and len(s.strip()) > 3]


def classify_mention(section: str, sentence: str) -> Tuple[str, float, bool]:
    """
    Classifies a skill sentence mention into its evidence tier, calculates weight,
    and flags certified credentials.
    Returns: Tuple[mention_tier, evidence_weight, is_certified]
    """
    sec_lower = section.lower()

    if sec_lower == "certifications":
        return "certified", EVIDENCE_WEIGHTS["certified"], True

    if sec_lower == "skills":
        return "skills_bar", EVIDENCE_WEIGHTS["skills_bar"], False

    if sec_lower == "summary":
        return "summary", EVIDENCE_WEIGHTS["summary"], False

    if sec_lower == "education":
        return "education", EVIDENCE_WEIGHTS["education"], False

    # In experience, projects, or work history: inspect actions and metrics
    has_action = bool(ACTION_VERB_RE.search(sentence))
    has_metric = bool(METRIC_RE.search(sentence))

    if has_action and has_metric:
        return "demonstrated_impact", EVIDENCE_WEIGHTS["demonstrated_impact"], False

    if has_action:
        return "demonstrated", EVIDENCE_WEIGHTS["demonstrated"], False

    return "contextual", EVIDENCE_WEIGHTS["contextual"], False


def enrich_candidate_skills(
    raw_text: str,
    experience_items: Optional[List[Dict[str, Any]]] = None,
    candidate_skills: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Full Context Enrichment:
    1. Matches skill spans via spaCy PhraseMatcher.
    2. Fuses spans with section anchors and line numbers.
    3. Inherits normalized dates and company metadata from structured experience entries.
    4. Computes recency, mention tiers, impact metrics, and certification status per skill.
    """
    if not raw_text:
        return []

    lines, anchors = anchor_sections(raw_text)
    matcher = SkillMatcher.get_instance()
    rich_matches = matcher.find_rich(raw_text)

    # Build line span offsets
    line_spans = []
    curr_offset = 0
    for idx, (line, (sec, entry_idx)) in enumerate(zip(lines, anchors), start=1):
        line_len = len(line)
        line_spans.append({
            "line_no": idx,
            "char_start": curr_offset,
            "char_end": curr_offset + line_len,
            "section": sec,
            "entry_idx": entry_idx,
            "line_text": line,
        })
        curr_offset += line_len + 1

    # Map experience items by entry_index (1-indexed)
    exp_by_idx: Dict[int, Dict[str, Any]] = {}
    if experience_items:
        for idx, item in enumerate(experience_items, start=1):
            exp_by_idx[idx] = item

    # Group mentions by canonical skill name
    mentions_by_skill: Dict[str, List[Dict[str, Any]]] = {}

    for m in rich_matches:
        cname = m["canonical_name"]
        c_start = m["char_start"]
        
        enclosing = next(
            (ls for ls in line_spans if ls["char_start"] <= c_start <= ls["char_end"]),
            None
        )
        sec = enclosing["section"] if enclosing else "header"
        entry_idx = enclosing["entry_idx"] if enclosing else None
        line_no = enclosing["line_no"] if enclosing else 1
        line_text = enclosing["line_text"] if enclosing else m["surface"]

        # Extract sentence containing the mention
        sentences = split_into_sentences(line_text)
        mention_sentence = line_text
        for s in sentences:
            if m["surface"].lower() in s.lower():
                mention_sentence = s
                break

        # Classify tier and evidence weight
        tier, weight, is_cert = classify_mention(sec, mention_sentence)

        # Inherit structured dates from experience entry if available
        inherited_role = None
        inherited_company = None
        start_date = None
        end_date = None
        is_current_role = False

        if sec == "experience" and entry_idx is not None and entry_idx in exp_by_idx:
            job = exp_by_idx[entry_idx]
            inherited_role = job.get("role")
            inherited_company = job.get("company")
            start_date = job.get("start_date")
            end_date = job.get("end_date")
            is_current_role = job.get("is_current_role", False)
        elif sec == "experience" and experience_items and len(experience_items) > 0:
            # Fallback to primary role
            job = experience_items[0]
            inherited_role = job.get("role")
            inherited_company = job.get("company")
            start_date = job.get("start_date")
            end_date = job.get("end_date")
            is_current_role = job.get("is_current_role", False)

        mention_record = {
            "surface": m["surface"],
            "section": sec,
            "entry_index": entry_idx,
            "line_number": line_no,
            "sentence": mention_sentence,
            "mention_tier": tier,
            "evidence_weight": weight,
            "is_certified": is_cert,
            "role": inherited_role,
            "company": inherited_company,
            "start_date": start_date,
            "end_date": end_date,
            "is_current_role": is_current_role,
            "has_action_verb": bool(ACTION_VERB_RE.search(mention_sentence)),
            "has_metric": bool(METRIC_RE.search(mention_sentence)),
        }

        if cname not in mentions_by_skill:
            mentions_by_skill[cname] = []
        mentions_by_skill[cname].append(mention_record)

    # Check for any extra skills from candidate_skills not in rich_matches
    if candidate_skills:
        for s in candidate_skills:
            if s not in mentions_by_skill:
                # Add base entry from skills section
                mentions_by_skill[s] = [{
                    "surface": s,
                    "section": "skills",
                    "entry_index": None,
                    "line_number": 1,
                    "sentence": f"Skills: {s}",
                    "mention_tier": "skills_bar",
                    "evidence_weight": 1.0,
                    "is_certified": False,
                    "role": None,
                    "company": None,
                    "start_date": None,
                    "end_date": None,
                    "is_current_role": False,
                    "has_action_verb": False,
                    "has_metric": False,
                }]

    # Build aggregated skill entities
    TIER_RANK = {
        "demonstrated_impact": 5,
        "demonstrated": 4,
        "contextual": 3,
        "skills_bar": 2,
        "certified": 2,
        "summary": 1,
        "education": 0,
    }

    enriched_entities: List[Dict[str, Any]] = []

    for cname, mentions in mentions_by_skill.items():
        max_weight = max(m["evidence_weight"] for m in mentions)
        best_mention = max(mentions, key=lambda m: (TIER_RANK.get(m["mention_tier"], 0), m["evidence_weight"]))
        highest_tier = best_mention["mention_tier"]
        has_certification = any(m["is_certified"] for m in mentions)

        # Check recency and active production usage
        is_active = any(m.get("is_current_role") for m in mentions)
        last_date = "present" if is_active else None
        
        if not is_active:
            # Find latest end_date
            dates = [m["end_date"] for m in mentions if m.get("end_date") and m["end_date"] != "Unknown"]
            last_date = dates[0] if dates else "Recent"

        enriched_entities.append({
            "canonical_name": cname,
            "category": matcher.row_by_id.get(f"skill-{cname.lower()}", {}).get("category", "tool"),
            "highest_mention_tier": highest_tier,
            "max_evidence_weight": max_weight,
            "is_certified": has_certification,
            "is_actively_used": is_active,
            "last_used_date": last_date,
            "mentions_count": len(mentions),
            "evidence_mentions": mentions,
        })

    # Sort: highest evidence weight desc, actively used desc, canonical_name asc
    enriched_entities.sort(
        key=lambda e: (-e["max_evidence_weight"], not e["is_actively_used"], e["canonical_name"].lower())
    )

    return enriched_entities
