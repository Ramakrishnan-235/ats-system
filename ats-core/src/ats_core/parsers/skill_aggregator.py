"""
skill_aggregator.py
Step 8: Aggregation -> What the Scoring Engine Consumes.

Transforms granular skill mentions into aggregated, interval-merged candidate skill records
ready for database persistence and deterministic scoring evaluation.

Features:
1. Non-overlapping date interval merging (concurrent roles sharing a skill do NOT double-count).
2. Accurate months and years of production experience calculations.
3. Stale usage detection (months_since_last_use) and active status tracking (is_current).
4. Independent certification tracking and best evidence tier selection.
5. Emits the Structured Scoring Engine Matrix consumed by compliance and match evaluators.
"""

import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

import dateparser

from ats_core.parsers.context_enricher import EVIDENCE_WEIGHTS
from ats_core.parsers.normalizers import PRESENT_TOKENS
from ats_core.taxonomy.seed_data import TAXONOMY_VERSION

logger = logging.getLogger("ats.parsers.skill_aggregator")


def parse_date_to_datetime(
    date_str: str | None,
    is_end: bool = False,
    reference_date: datetime | None = None
) -> datetime | None:
    """
    Parses a normalized date string ("2021-05", "2020", "Present") into a datetime object.
    For end dates of a month/year, aligns to the end of that period.
    """
    if not date_str:
        return None

    clean = str(date_str).strip().lower()
    ref = reference_date or datetime.now()

    if clean in PRESENT_TOKENS or clean == "present":
        return ref

    # Year only: "2021"
    if re.fullmatch(r"\d{4}", clean):
        year = int(clean)
        if is_end:
            return datetime(year, 12, 31, 23, 59, 59)
        return datetime(year, 1, 1, 0, 0, 0)

    # Year-Month: "2021-05"
    m = re.fullmatch(r"(\d{4})-(\d{1,2})", clean)
    if m:
        year = int(m.group(1))
        month = int(m.group(2))
        if is_end:
            # End of month
            if month in (1, 3, 5, 7, 8, 10, 12):
                day = 31
            elif month in (4, 6, 9, 11):
                day = 30
            else:
                day = 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28
            return datetime(year, month, day, 23, 59, 59)
        return datetime(year, month, 1, 0, 0, 0)

    # Fallback to dateparser
    dt = dateparser.parse(clean, settings={"PREFER_DATES_FROM": "past"})
    return dt


def merge_date_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    """
    Merges overlapping and contiguous datetime intervals so concurrent roles
    mentioning the same skill are not double counted.
    """
    if not intervals:
        return []

    # Filter invalid intervals where start > end
    valid_intervals = [
        (s, e) for s, e in intervals
        if s is not None and e is not None and s <= e
    ]
    if not valid_intervals:
        return []

    # Sort chronologically by start date
    valid_intervals.sort(key=lambda x: x[0])

    merged: list[tuple[datetime, datetime]] = [valid_intervals[0]]

    for current in valid_intervals[1:]:
        prev_start, prev_end = merged[-1]
        curr_start, curr_end = current

        if curr_start <= prev_end:
            # Overlapping or contiguous: extend previous interval
            merged[-1] = (prev_start, max(prev_end, curr_end))
        else:
            # Disjoint: start new interval
            merged.append(current)

    return merged


def aggregate_skill_mentions(
    mentions: list[dict[str, Any]],
    reference_date: datetime | None = None,
    candidate_id: str | None = None
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """
    Aggregates granular skill mentions:
    Returns:
    1. List of CandidateSkill database row dictionaries.
    2. Structured Scoring Engine Matrix keyed by lowercase canonical skill name.
    """
    ref_dt = reference_date or datetime.now()
    by_skill: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for m in mentions:
        skill_key = m.get("canonical_name") or m.get("surface") or "Unknown"
        by_skill[skill_key].append(m)

    db_rows: list[dict[str, Any]] = []
    scoring_matrix: dict[str, dict[str, Any]] = {}

    for skill_name, ms in by_skill.items():
        skill_id = ms[0].get("skill_id") or f"skill-{skill_name.lower().replace(' ', '-')}"

        # Collect date intervals
        raw_intervals: list[tuple[datetime, datetime]] = []
        for m in ms:
            d_start = m.get("start_date")
            d_end = m.get("end_date")
            if d_start and d_end:
                dt_s = parse_date_to_datetime(d_start, is_end=False, reference_date=ref_dt)
                dt_e = parse_date_to_datetime(d_end, is_end=True, reference_date=ref_dt)
                if dt_s and dt_e:
                    raw_intervals.append((dt_s, dt_e))

        merged = merge_date_intervals(raw_intervals)

        total_days = sum((e - s).days for s, e in merged) if merged else 0
        months_of_use = round(total_days / 30.44) if merged and total_days > 0 else None
        years_of_use = round((months_of_use / 12.0), 1) if months_of_use is not None else None

        # Check if currently used in active role
        is_current = any(
            str(m.get("end_date", "")).strip().lower() in PRESENT_TOKENS
            or m.get("is_current_role", False)
            for m in ms
        )

        first_used = merged[0][0].strftime("%Y-%m") if merged else None
        last_used = "Present" if is_current else (merged[-1][1].strftime("%Y-%m") if merged else None)

        # Months since last use (staleness detection)
        months_since_last_use = None
        if not is_current and merged:
            last_end_dt = merged[-1][1]
            diff_days = (ref_dt - last_end_dt).days
            months_since_last_use = max(0, round(diff_days / 30.44))

        # Best evidence tier selection
        best_mention = max(
            ms,
            key=lambda m: EVIDENCE_WEIGHTS.get(m.get("mention_tier", "skills_bar"), 1.0)
        )
        best_evidence = best_mention.get("mention_tier", "skills_bar")
        weighted_score = round(sum(m.get("evidence_weight", 1.0) for m in ms), 1)
        is_certified = any(m.get("is_certified") or m.get("mention_tier") == "certified" for m in ms)

        # Unique roles where this skill was used
        distinct_roles = {
            m.get("role") for m in ms
            if m.get("role") and m.get("role") != "N/A"
        }
        roles_count = len(distinct_roles)

        # Build auditable explanation
        if years_of_use and years_of_use > 0:
            status_desc = "current" if is_current else f"last used {last_used}"
            explanation = (
                f"{years_of_use} yrs ({status_desc}), {best_evidence.replace('_', ' ')} "
                f"across {roles_count or 1} role(s)"
            )
        elif is_certified:
            explanation = "Certified credential, demonstrated in resume"
        else:
            explanation = "Claimed in skills summary"

        # 1. Database Row Record
        row = {
            "candidate_id": candidate_id,
            "skill_id": skill_id,
            "canonical_name": skill_name,
            "mention_count": len(ms),
            "weighted_score": weighted_score,
            "best_evidence": best_evidence,
            "is_certified": is_certified,
            "first_used": first_used,
            "last_used": last_used,
            "is_current": is_current,
            "months_of_use": months_of_use,
            "months_since_last_use": months_since_last_use,
            "taxonomy_version": TAXONOMY_VERSION,
        }
        db_rows.append(row)

        # 2. Scoring Engine Consumption Matrix
        scoring_matrix[skill_name.lower()] = {
            "canonical_name": skill_name,
            "skill_id": skill_id,
            "years": years_of_use if years_of_use is not None else 0.0,
            "months_of_use": months_of_use or 0,
            "current": is_current,
            "months_since_last_use": months_since_last_use,
            "evidence": best_evidence,
            "weighted": weighted_score,
            "certified": is_certified,
            "mention_count": len(ms),
            "roles_count": roles_count,
            "explanation": explanation,
        }

    # Sort database rows by weighted_score desc
    db_rows.sort(key=lambda r: -r["weighted_score"])

    return db_rows, scoring_matrix
