"""
taxonomy_service.py
Database-backed, versioned skill taxonomy service featuring:
1. Fast dual-layer in-memory lookup cache compiled from database & seed ontology.
2. Exact short-acronym ambiguity protection (prevents 'C', 'R', 'Go' from fuzzy corruption).
3. RapidFuzz typo-tolerant canonical mapping.
4. Autonomous Flywheel Queue for newly encountered / LLM-extracted unmapped skills.
5. Administrative approval and alias-promotion lifecycle.
"""

import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Set
from rapidfuzz import process, fuzz

from ats_core.taxonomy.seed_data import SEED_SKILLS, TAXONOMY_VERSION

logger = logging.getLogger("ats.taxonomy.service")

# Critical distinct mappings for short ambiguous skills
EXACT_SHORT_MAP = {
    "c": "C",
    "c++": "C++",
    "cpp": "C++",
    "c#": "C#",
    "csharp": "C#",
    "r": "R",
    "go": "Go",
    "golang": "Go",
    "js": "JavaScript",
    "ts": "TypeScript",
    "sql": "SQL",
    "git": "Git",
    "ai": "Artificial Intelligence",
    "ml": "Machine Learning",
    "dl": "Deep Learning",
    "nlp": "Natural Language Processing",
    "cv": "Computer Vision",
    "ui": "UI/UX",
    "ux": "UI/UX",
    "ci": "CI/CD",
    "cd": "CI/CD",
    "qa": "QA",
    "k8s": "Kubernetes",
}

SHORT_EXACT_SKILLS = {
    "c", "r", "go", "c++", "cpp", "c#", "csharp", "js", "ts", "sql", "git",
    "ai", "ml", "dl", "nlp", "cv", "ui", "ux", "ci", "cd", "qa", "k8s", "rn", "tf", "es", "sh"
}


class SkillTaxonomyService:
    """
    Singleton service managing the versioned Skills Taxonomy and Flywheel review queue.
    """
    _instance: Optional["SkillTaxonomyService"] = None

    def __init__(self):
        self.version = TAXONOMY_VERSION
        # Master in-memory store: id -> record
        self._skills_by_id: Dict[str, Dict[str, Any]] = {}
        # Canonical index: canonical_name_lower -> record
        self._canonical_index: Dict[str, Dict[str, Any]] = {}
        # Alias lookup index: alias_lower -> canonical_name
        self._alias_index: Dict[str, str] = {}
        # Ambiguous tokens set
        self._ambiguous_tokens: Set[str] = set(SHORT_EXACT_SKILLS)

        # Initialize from seed data
        self._seed_taxonomy()

    @classmethod
    def get_instance(cls) -> "SkillTaxonomyService":
        if cls._instance is None:
            cls._instance = SkillTaxonomyService()
        return cls._instance

    def _seed_taxonomy(self):
        """Loads default curated ontology into memory store."""
        for skill in SEED_SKILLS:
            skill_id = f"skill-{uuid.uuid5(uuid.NAMESPACE_DNS, skill['canonical_name']).hex[:8]}"
            record = {
                "id": skill_id,
                "canonical_name": skill["canonical_name"],
                "category": skill["category"],
                "aliases": list(skill.get("aliases", [])),
                "is_ambiguous": skill.get("is_ambiguous", False),
                "status": "approved",
                "source": skill.get("source", "lightcast"),
                "occurrence_count": 1,
                "taxonomy_version": self.version,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._register_record(record)
        logger.info(f"Loaded {len(self._canonical_index)} canonical skills into taxonomy service (version {self.version}).")

    def _register_record(self, record: Dict[str, Any]):
        """Registers a skill record into memory indexes."""
        self._skills_by_id[record["id"]] = record
        canonical_key = self._normalize_key(record["canonical_name"])

        # Only approved skills participate in canonical resolution
        if record.get("status") == "approved":
            self._canonical_index[canonical_key] = record

            # Register canonical name as an alias to itself
            self._alias_index[canonical_key] = record["canonical_name"]

            # Register all aliases
            for alias in record.get("aliases", []):
                alias_key = self._normalize_key(alias)
                if alias_key:
                    self._alias_index[alias_key] = record["canonical_name"]

            if record.get("is_ambiguous") and len(canonical_key) <= 3:
                self._ambiguous_tokens.add(canonical_key)

    def _normalize_key(self, token: str) -> str:
        if not token:
            return ""
        # Preserve technical characters '+', '#', '.', '/', '-'
        cleaned = re.sub(r"[^\w\s+#./-]", "", token.lower()).strip()
        return cleaned

    def lookup_skill(self, raw_skill: str, fuzzy_cutoff: float = 88.0) -> Optional[Dict[str, Any]]:
        """
        Resolves a raw candidate skill string to its canonical taxonomy record.
        1. Exact short-acronym protection.
        2. Direct canonical & alias dictionary lookup.
        3. High-precision fuzzy matching for typos (tokens >= 4 chars).
        """
        if not raw_skill or not isinstance(raw_skill, str):
            return None

        cleaned = raw_skill.strip()
        if not cleaned:
            return None

        key = self._normalize_key(cleaned)

        # 1. Short Acronym Protection Guard
        if key in EXACT_SHORT_MAP:
            target_canonical = EXACT_SHORT_MAP[key]
            return self.get_skill_by_canonical(target_canonical)

        if key in self._ambiguous_tokens:
            if key in self._alias_index:
                return self.get_skill_by_canonical(self._alias_index[key])
            return None

        # 2. Direct Alias / Canonical Lookup
        if key in self._alias_index:
            canonical_name = self._alias_index[key]
            return self.get_skill_by_canonical(canonical_name)

        # Alternative key stripping symbols (e.g. 'react.js' -> 'reactjs')
        alt_key = re.sub(r"[^\w\s]", "", key).strip()
        if alt_key in self._alias_index:
            canonical_name = self._alias_index[alt_key]
            return self.get_skill_by_canonical(canonical_name)

        # 3. High-Precision Fuzzy Matching (only for words >= 4 chars)
        if len(key) >= 4:
            match = process.extractOne(
                key,
                list(self._alias_index.keys()),
                scorer=fuzz.WRatio,
                score_cutoff=fuzzy_cutoff
            )
            if match:
                matched_alias = match[0]
                if matched_alias not in self._ambiguous_tokens and len(matched_alias) >= 4:
                    canonical_name = self._alias_index[matched_alias]
                    return self.get_skill_by_canonical(canonical_name)

        return None

    def get_skill_by_canonical(self, canonical_name: str) -> Optional[Dict[str, Any]]:
        key = self._normalize_key(canonical_name)
        return self._canonical_index.get(key)

    def get_skill_by_id(self, skill_id: str) -> Optional[Dict[str, Any]]:
        return self._skills_by_id.get(skill_id)

    def record_unknown_skill(
        self,
        raw_skill: str,
        source: str = "resume_parser",
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        The Flywheel: Captures any unrecognized skill into status='pending'
        for administrative review and automated compound growth.
        """
        cleaned = raw_skill.strip()
        if not cleaned or len(cleaned) < 2 or len(cleaned) > 50:
            return {}

        key = self._normalize_key(cleaned)
        
        # Check if already in pending index first
        for skill in self._skills_by_id.values():
            if self._normalize_key(skill["canonical_name"]) == key and skill["status"] == "pending":
                skill["occurrence_count"] = skill.get("occurrence_count", 1) + 1
                skill["updated_at"] = datetime.now(timezone.utc).isoformat()
                return skill

        # If it already resolves to an approved record, return that
        existing = self.lookup_skill(cleaned)
        if existing and existing.get("status") == "approved":
            return existing

        # Create new pending entry
        new_id = f"skill-pending-{uuid.uuid4().hex[:6]}"
        
        # Guess category based on heuristics
        category = "tool"
        lower_c = cleaned.lower()
        if any(w in lower_c for w in ["js", "script", "lang", "python", "java", "sql", "c++", "ruby"]):
            category = "language"
        elif any(w in lower_c for w in ["db", "database", "sql", "mongo", "redis"]):
            category = "database"
        elif any(w in lower_c for w in ["aws", "cloud", "azure", "gcp", "docker", "k8s"]):
            category = "platform"
        elif any(w in lower_c for w in ["ai", "learning", "torch", "tensor", "vision", "nlp"]):
            category = "library"

        pending_record = {
            "id": new_id,
            "canonical_name": cleaned.capitalize() if cleaned[0].islower() else cleaned,
            "category": category,
            "aliases": [cleaned.lower()],
            "is_ambiguous": len(cleaned) <= 3,
            "status": "pending",
            "source": source,
            "occurrence_count": 1,
            "taxonomy_version": self.version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "context_sample": context[:120] if context else None
        }

        self._register_record(pending_record)
        logger.info(f"Flywheel registered new pending skill '{cleaned}' from source={source}.")
        return pending_record

    def approve_skill(
        self,
        skill_id: str,
        canonical_name: Optional[str] = None,
        category: Optional[str] = None,
        aliases: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """Promotes a pending skill to approved canonical status."""
        record = self._skills_by_id.get(skill_id)
        if not record:
            return None

        if canonical_name:
            # Re-index canonical name
            old_key = self._normalize_key(record["canonical_name"])
            if old_key in self._canonical_index:
                del self._canonical_index[old_key]
            record["canonical_name"] = canonical_name

        if category:
            record["category"] = category

        if aliases is not None:
            record["aliases"] = list(set(record.get("aliases", []) + aliases))

        record["status"] = "approved"
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Refresh indexing
        self._register_record(record)
        return record

    def reject_skill(self, skill_id: str) -> Optional[Dict[str, Any]]:
        """Marks a pending skill as rejected (ignored)."""
        record = self._skills_by_id.get(skill_id)
        if not record:
            return None

        record["status"] = "rejected"
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        return record

    def add_alias(self, canonical_name: str, new_alias: str) -> Optional[Dict[str, Any]]:
        """Adds a new alias to an existing approved canonical skill."""
        record = self.get_skill_by_canonical(canonical_name)
        if not record:
            return None

        cleaned_alias = new_alias.strip()
        if cleaned_alias and cleaned_alias not in record["aliases"]:
            record["aliases"].append(cleaned_alias)
            self._register_record(record)

        return record

    def list_skills(
        self,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Queries skills with filtering, search, and pagination."""
        skills = list(self._skills_by_id.values())

        if status and status.lower() != "all":
            skills = [s for s in skills if s.get("status") == status.lower()]

        if category and category.lower() != "all":
            skills = [s for s in skills if s.get("category") == category.lower()]

        if search:
            q = search.lower().strip()
            skills = [
                s for s in skills
                if q in s.get("canonical_name", "").lower()
                or any(q in a.lower() for a in s.get("aliases", []))
                or q in s.get("category", "").lower()
                or q in (s.get("source") or "").lower()
            ]

        # Sort: pending first by occurrence_count desc, then canonical_name asc
        skills.sort(
            key=lambda s: (
                0 if s.get("status") == "pending" else 1,
                -s.get("occurrence_count", 1),
                s.get("canonical_name", "").lower()
            )
        )

        total = len(skills)
        start = (page - 1) * limit
        end = start + limit
        return skills[start:end], total

    def get_taxonomy_stats(self) -> Dict[str, Any]:
        """Returns overview statistics of the taxonomy and flywheel review queue."""
        total = len(self._skills_by_id)
        approved = sum(1 for s in self._skills_by_id.values() if s.get("status") == "approved")
        pending = sum(1 for s in self._skills_by_id.values() if s.get("status") == "pending")
        rejected = sum(1 for s in self._skills_by_id.values() if s.get("status") == "rejected")

        cat_counts: Dict[str, int] = {}
        for s in self._skills_by_id.values():
            if s.get("status") == "approved":
                c = s.get("category", "tool")
                cat_counts[c] = cat_counts.get(c, 0) + 1

        return {
            "version": self.version,
            "total_skills": total,
            "approved_count": approved,
            "pending_count": pending,
            "rejected_count": rejected,
            "categories": cat_counts,
        }
