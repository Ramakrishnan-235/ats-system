"""
skill_matcher.py
Step 3: Gazetteer Matching (Taxonomy -> Text Spans).

Uses spaCy's PhraseMatcher for token-boundary accurate gazetteer matching:
1. Token-boundary matching prevents false positives (e.g., 'Java' matching inside 'JavaScript').
2. Symmetric tokenization preserves punctuation-heavy aliases ('C++', 'C#', 'Node.js', 'React.js').
3. Longest-match-first interval deduplication ('React Native' beats 'React', 'C++' beats 'C').
4. Millisecond execution speed across thousands of taxonomy entries.
5. Emits character and token spans for exact evidence anchoring.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple, Set
import spacy
from spacy.matcher import PhraseMatcher

from ats_core.parsers.section_anchor import anchor_sections
from ats_core.parsers.disambiguation import is_valid_mention

logger = logging.getLogger("ats.parsers.skill_matcher")


class SkillMatcher:
    """
    High-performance Gazetteer Matcher leveraging spaCy PhraseMatcher.
    """
    _instance: Optional["SkillMatcher"] = None

    def __init__(self, taxonomy_rows: Optional[List[Dict[str, Any]]] = None):
        self.nlp = spacy.blank("en")
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        self.row_by_id: Dict[str, Dict[str, Any]] = {}
        self.id_by_key: Dict[str, str] = {}

        if taxonomy_rows is None:
            from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService
            taxonomy_service = SkillTaxonomyService.get_instance()
            taxonomy_rows = list(taxonomy_service._skills_by_id.values())

        self._build_matcher(taxonomy_rows)

    @classmethod
    def get_instance(cls) -> "SkillMatcher":
        if cls._instance is None:
            cls._instance = SkillMatcher()
        return cls._instance

    def reload(self, taxonomy_rows: Optional[List[Dict[str, Any]]] = None):
        """Re-indexes PhraseMatcher patterns with updated taxonomy rows."""
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        self.row_by_id = {}
        self.id_by_key = {}

        if taxonomy_rows is None:
            from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService
            taxonomy_service = SkillTaxonomyService.get_instance()
            taxonomy_rows = list(taxonomy_service._skills_by_id.values())

        self._build_matcher(taxonomy_rows)

    def _build_matcher(self, taxonomy_rows: List[Dict[str, Any]]):
        """Compiles phrase patterns into spaCy PhraseMatcher."""
        added_count = 0
        for row in taxonomy_rows:
            if row.get("status") != "approved":
                continue

            canonical = row.get("canonical_name", "").strip()
            if not canonical:
                continue

            surfaces = [canonical, *row.get("aliases", [])]
            # Clean and filter empty surface patterns
            clean_surfaces = list({s.strip() for s in surfaces if s and s.strip()})
            if not clean_surfaces:
                continue

            key = f"SKILL_{row['id']}"
            patterns = [self.nlp.make_doc(s.lower()) for s in clean_surfaces]
            self.matcher.add(key, patterns)

            self.row_by_id[row["id"]] = row
            self.id_by_key[key] = row["id"]
            added_count += 1

        logger.info(f"SkillMatcher indexed {added_count} canonical skills with spaCy PhraseMatcher.")

    def find(self, text: str) -> List[Tuple[str, str, int, int, int, int]]:
        """
        Extracts skill mentions from text.
        Returns: List of tuples (skill_id, surface_text, tok_start, tok_end, char_start, char_end).
        Applies longest-match-first non-overlapping interval deduplication.
        """
        if not text or not isinstance(text, str):
            return []

        doc = self.nlp.make_doc(text)
        matches = []
        for match_id, start, end in self.matcher(doc):
            match_key = self.matcher.vocab.strings[match_id]
            skill_id = self.id_by_key.get(match_key)
            if not skill_id:
                continue

            row = self.row_by_id.get(skill_id, {})
            # Step 4: Disambiguation Context Gate for ambiguous short skills
            if not is_valid_mention(row, doc, start, end):
                continue

            span = doc[start:end]
            matches.append((
                skill_id,
                span.text,
                start,
                end,
                span.start_char,
                span.end_char
            ))

        # Longest-match-first dedupe: token length desc, char length desc
        matches.sort(key=lambda m: (m[3] - m[2], m[5] - m[4]), reverse=True)
        taken: List[Tuple[int, int]] = []
        out: List[Tuple[str, str, int, int, int, int]] = []

        for m in matches:
            # Overlap check: char_start < taken_end and taken_start < char_end
            if any(m[4] < te and ts < m[5] for ts, te in taken):
                continue
            taken.append((m[4], m[5]))
            out.append(m)

        # Restore chronological reading order
        out.sort(key=lambda m: m[4])
        return out

    def find_rich(self, text: str) -> List[Dict[str, Any]]:
        """
        Returns rich structured matches with metadata for downstream evidence anchoring.
        """
        raw_matches = self.find(text)
        results: List[Dict[str, Any]] = []

        for skill_id, surface, tok_start, tok_end, char_start, char_end in raw_matches:
            row = self.row_by_id.get(skill_id, {})
            results.append({
                "skill_id": skill_id,
                "canonical_name": row.get("canonical_name", surface),
                "category": row.get("category", "tool"),
                "surface": surface,
                "tok_start": tok_start,
                "tok_end": tok_end,
                "char_start": char_start,
                "char_end": char_end,
                "source": row.get("source", "lightcast"),
                "taxonomy_version": row.get("taxonomy_version", "2026.08.1"),
            })

        return results

    def extract_canonical_skills(self, text: str) -> List[str]:
        """
        Returns deduplicated ordered list of canonical skill names detected in text.
        """
        rich_matches = self.find_rich(text)
        seen: Set[str] = set()
        canonical_skills: List[str] = []

        for item in rich_matches:
            cname = item["canonical_name"]
            if cname.lower() not in seen:
                seen.add(cname.lower())
                canonical_skills.append(cname)

        return canonical_skills

    def match_skills_with_sections(self, text: str) -> List[Dict[str, Any]]:
        """
        Combines Gazetteer Matching with Section Anchoring:
        Attaches exact section ('experience', 'skills', 'projects', etc.),
        entry index (Job #1, Job #2), line number, and evidence weight to each matched skill span.
        """
        if not text:
            return []

        lines, anchors = anchor_sections(text)
        rich_matches = self.find_rich(text)

        # Build character offset line boundaries: list of (line_no, char_start, char_end, section, entry_idx, line_text)
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
            curr_offset += line_len + 1  # account for \n

        SECTION_WEIGHTS = {
            "experience": 1.0,
            "projects": 0.8,
            "summary": 0.6,
            "skills": 0.5,
            "certifications": 0.5,
            "education": 0.3,
            "header": 0.2,
        }

        results: List[Dict[str, Any]] = []
        for m in rich_matches:
            c_start = m["char_start"]
            # Find the enclosing line
            enclosing = next(
                (ls for ls in line_spans if ls["char_start"] <= c_start <= ls["char_end"]),
                None
            )

            sec = enclosing["section"] if enclosing else "header"
            entry_idx = enclosing["entry_idx"] if enclosing else None
            line_no = enclosing["line_no"] if enclosing else 1
            line_text = enclosing["line_text"] if enclosing else ""

            weight = SECTION_WEIGHTS.get(sec, 0.4)

            results.append({
                **m,
                "section": sec,
                "entry_index": entry_idx,
                "line_number": line_no,
                "line_text": line_text,
                "evidence_weight": weight,
            })

        return results
