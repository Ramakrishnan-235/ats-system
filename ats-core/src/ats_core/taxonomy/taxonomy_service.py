"""
taxonomy_service.py
Database-backed, versioned skill taxonomy service featuring:
1. Fast dual-layer in-memory lookup cache compiled from database & seed ontology.
2. Exact short-acronym ambiguity protection (prevents 'C', 'R', 'Go' from fuzzy corruption).
3. RapidFuzz typo-tolerant canonical mapping with cached alias keys (eliminates per-lookup O(n) allocations).
4. Autonomous Flywheel Queue with bounded capacity, prose stopword rejection, and O(1) pending index.
5. Administrative approval and alias-promotion lifecycle with collision protection.
"""

import os
import re
import uuid
import logging
import threading
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

# Generic resume prose and stop words rejected from auto-entering flywheel review queue
RESUME_PROSE_STOPWORDS: Set[str] = {
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday", "sunday", "bachelor", "master", "doctor",
    "phd", "degree", "university", "college", "school", "education", "experience",
    "summary", "project", "projects", "manager", "director", "president", "engineer",
    "developer", "analyst", "consultant", "intern", "associate", "company", "corporation",
    "department", "responsibilities", "achievements", "managed", "designed", "developed",
    "created", "implemented", "responsible", "building", "leading", "working", "skills",
    "united", "states", "america", "remote", "hybrid", "onsite", "present", "current",
    "overview", "objective", "profile", "contact", "phone", "email", "address", "resume",
    "curriculum", "vitae", "references", "available", "upon", "request", "team", "client",
    "years", "year", "months", "month", "lead", "senior", "junior", "principal", "staff",
}


class SkillTaxonomyService:
    """
    Singleton service managing the versioned Skills Taxonomy and Flywheel review queue.
    """
    _instance: Optional["SkillTaxonomyService"] = None
    _instance_lock: threading.Lock = threading.Lock()

    def __init__(self):
        self.version = TAXONOMY_VERSION
        self.max_pending_skills: int = int(os.getenv("ATS_MAX_PENDING_SKILLS", "1000"))
        self.max_total_skills: int = int(os.getenv("ATS_MAX_TOTAL_SKILLS", "10000"))
        # Master in-memory store: id -> record
        self._skills_by_id: Dict[str, Dict[str, Any]] = {}
        # Canonical index: canonical_name_lower -> record
        self._canonical_index: Dict[str, Dict[str, Any]] = {}
        # Alias lookup index: alias_lower -> canonical_name
        self._alias_index: Dict[str, str] = {}
        # O(1) pending index: canonical_key -> pending_record
        self._pending_index: Dict[str, Dict[str, Any]] = {}
        # Ambiguous tokens set
        self._ambiguous_tokens: Set[str] = set(SHORT_EXACT_SKILLS)
        # Pre-allocated cached key arrays for fast fuzzy lookups (invalidated on mutation)
        self._cached_fuzzy_keys: Optional[List[str]] = None
        self._cached_alias_keys: Optional[List[str]] = None

        # Initialize from seed data
        self.sync_seed()

    @classmethod
    def get_instance(cls) -> "SkillTaxonomyService":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = SkillTaxonomyService()
        return cls._instance

    def _invalidate_lookup_cache(self) -> None:
        """Invalidates cached alias lists when taxonomy is mutated."""
        self._cached_fuzzy_keys = None
        self._cached_alias_keys = None

    def get_fuzzy_keys(self) -> List[str]:
        """
        Returns cached list of alias keys eligible for fuzzy matching (len >= 4, non-ambiguous).
        Avoids rebuilding list on every fuzzy lookup.
        """
        if self._cached_fuzzy_keys is None:
            self._cached_fuzzy_keys = [
                k for k in self._alias_index.keys()
                if len(k) >= 4 and k not in self._ambiguous_tokens
            ]
        return self._cached_fuzzy_keys

    def get_alias_keys(self) -> List[str]:
        """Returns cached list of all alias keys."""
        if self._cached_alias_keys is None:
            self._cached_alias_keys = list(self._alias_index.keys())
        return self._cached_alias_keys

    def sync_seed(self) -> Dict[str, Any]:
        """
        Safely synchronizes the seed ontology into the taxonomy store.
        Preserves all approved user edits, custom skills, and custom aliases on seeded skills.
        """
        added_count = 0
        updated_count = 0

        for seed in SEED_SKILLS:
            seed_canonical = seed["canonical_name"]
            seed_id = f"skill-{uuid.uuid5(uuid.NAMESPACE_DNS, seed_canonical).hex[:8]}"

            canonical_key = self._normalize_key(seed_canonical)
            existing = self._skills_by_id.get(seed_id) or self._canonical_index.get(canonical_key)

            if existing:
                # Skill already exists in store! Preserve all user edits and customizations.
                # Only add missing seed aliases that do not collide with another skill.
                existing_aliases = existing.get("aliases", [])
                existing_aliases_lower = {a.lower() for a in existing_aliases}

                modified = False
                for s_alias in seed.get("aliases", []):
                    s_clean = s_alias.strip()
                    if s_clean and s_clean.lower() not in existing_aliases_lower:
                        a_key = self._normalize_key(s_clean)
                        conflict = False
                        if a_key in self._canonical_index and self._canonical_index[a_key]["id"] != existing["id"]:
                            conflict = True
                        if a_key in self._alias_index:
                            owner = self._alias_index[a_key]
                            owner_rec = self._canonical_index.get(self._normalize_key(owner))
                            if owner_rec and owner_rec["id"] != existing["id"]:
                                conflict = True
                        if not conflict:
                            existing_aliases.append(s_clean)
                            existing_aliases_lower.add(s_clean.lower())
                            modified = True

                if modified:
                    existing["updated_at"] = datetime.now(timezone.utc).isoformat()
                    self._register_record(existing)
                    updated_count += 1
            else:
                # Brand new seed skill to register
                record = {
                    "id": seed_id,
                    "canonical_name": seed_canonical,
                    "category": seed["category"],
                    "aliases": list(seed.get("aliases", [])),
                    "is_ambiguous": seed.get("is_ambiguous", False),
                    "status": "approved",
                    "source": seed.get("source", "lightcast"),
                    "occurrence_count": 1,
                    "taxonomy_version": self.version,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                self._register_record(record)
                added_count += 1

        # Re-index active pending skills into O(1) index
        self._pending_index = {
            self._normalize_key(s["canonical_name"]): s
            for s in self._skills_by_id.values()
            if s.get("status") == "pending"
        }
        self._invalidate_lookup_cache()

        logger.info(
            f"Taxonomy seed synced: {added_count} new skills added, "
            f"{updated_count} existing skills updated with non-conflicting seed aliases. "
            f"All approved edits and custom skills preserved."
        )
        return {
            "status": "SUCCESS",
            "added_count": added_count,
            "updated_count": updated_count,
            "stats": self.get_taxonomy_stats(),
        }

    def _seed_taxonomy(self):
        """Backward-compatibility helper; delegates to sync_seed."""
        return self.sync_seed()

    def _check_canonical_collision(self, canonical_name: str, current_skill_id: Optional[str] = None) -> None:
        """
        Ensures that canonical_name does not collide with another skill's canonical name
        or another skill's alias.
        """
        canonical_key = self._normalize_key(canonical_name)
        if not canonical_key:
            raise ValueError("Canonical skill name cannot be empty.")

        # 1. Collision with another skill's canonical name
        existing_canonical = self._canonical_index.get(canonical_key)
        if existing_canonical and existing_canonical.get("id") != current_skill_id:
            raise ValueError(
                f"Canonical skill '{canonical_name}' already exists in taxonomy (id: {existing_canonical.get('id')})."
            )

        # 2. Collision with another skill's alias
        existing_alias_target = self._alias_index.get(canonical_key)
        if existing_alias_target:
            target_record = self._canonical_index.get(self._normalize_key(existing_alias_target))
            if target_record and target_record.get("id") != current_skill_id:
                raise ValueError(
                    f"Canonical name '{canonical_name}' conflicts with alias of existing skill '{existing_alias_target}'."
                )

    def _check_alias_collision(self, alias: str, current_skill_id: Optional[str] = None) -> None:
        """
        Ensures that alias does not collide with another skill's canonical name
        or another skill's alias.
        """
        alias_key = self._normalize_key(alias)
        if not alias_key:
            raise ValueError("Alias cannot be empty.")

        # 1. Collision with another skill's canonical name
        existing_canonical = self._canonical_index.get(alias_key)
        if existing_canonical and existing_canonical.get("id") != current_skill_id:
            raise ValueError(
                f"Alias '{alias}' conflicts with canonical name of existing skill '{existing_canonical.get('canonical_name')}'."
            )

        # 2. Collision with another skill's alias
        existing_alias_target = self._alias_index.get(alias_key)
        if existing_alias_target:
            target_record = self._canonical_index.get(self._normalize_key(existing_alias_target))
            if target_record and target_record.get("id") != current_skill_id:
                raise ValueError(
                    f"Alias '{alias}' conflicts with existing skill '{existing_alias_target}'."
                )

    def _register_record(self, record: Dict[str, Any]):
        """Registers a skill record into memory indexes with collision guards."""
        self._skills_by_id[record["id"]] = record
        canonical_key = self._normalize_key(record["canonical_name"])

        # Only approved skills participate in canonical resolution
        if record.get("status") == "approved":
            existing_canonical = self._canonical_index.get(canonical_key)
            if existing_canonical and existing_canonical.get("id") != record["id"]:
                logger.warning(
                    f"Canonical index collision: '{record['canonical_name']}' (id: {record['id']}) "
                    f"cannot overwrite existing canonical skill (id: {existing_canonical.get('id')})."
                )
            else:
                self._canonical_index[canonical_key] = record
                self._alias_index[canonical_key] = record["canonical_name"]

            # Register all non-conflicting aliases
            for alias in record.get("aliases", []):
                alias_key = self._normalize_key(alias)
                if not alias_key:
                    continue

                if alias_key in self._alias_index:
                    existing_owner = self._alias_index[alias_key]
                    if existing_owner != record["canonical_name"]:
                        owner_rec = self._canonical_index.get(self._normalize_key(existing_owner))
                        if owner_rec and owner_rec.get("id") != record["id"]:
                            logger.warning(
                                f"Skipping conflicting alias '{alias}' for skill '{record['canonical_name']}'; "
                                f"already mapped to '{existing_owner}'."
                            )
                            continue

                self._alias_index[alias_key] = record["canonical_name"]

            if record.get("is_ambiguous") and len(canonical_key) <= 3:
                self._ambiguous_tokens.add(canonical_key)

        self._invalidate_lookup_cache()

    def _remove_lookup_entries(self, record: Dict[str, Any]) -> None:
        """Remove a record's old resolution entries before renaming or rejecting it."""
        for key, value in list(self._canonical_index.items()):
            if value["id"] == record["id"]:
                del self._canonical_index[key]
        for key, canonical_name in list(self._alias_index.items()):
            if canonical_name == record["canonical_name"]:
                del self._alias_index[key]
        self._invalidate_lookup_cache()

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
        3. High-precision fuzzy matching for typos (tokens >= 4 chars) using pre-cached alias array.
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
        # Uses cached list of fuzzy-eligible alias keys; avoids O(N) allocation on each call.
        if len(key) >= 4:
            fuzzy_keys = self.get_fuzzy_keys()
            if fuzzy_keys:
                match = process.extractOne(
                    key,
                    fuzzy_keys,
                    scorer=fuzz.WRatio,
                    score_cutoff=fuzzy_cutoff
                )
                if match:
                    matched_alias = match[0]
                    canonical_name = self._alias_index.get(matched_alias)
                    if canonical_name:
                        return self.get_skill_by_canonical(canonical_name)

        return None

    def get_skill_by_canonical(self, canonical_name: str) -> Optional[Dict[str, Any]]:
        key = self._normalize_key(canonical_name)
        record = self._canonical_index.get(key)
        return record if record and record.get("status") == "approved" else None

    def get_skill_by_id(self, skill_id: str) -> Optional[Dict[str, Any]]:
        return self._skills_by_id.get(skill_id)

    def record_unknown_skill(
        self,
        raw_skill: str,
        source: str = "resume_parser",
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        The Flywheel: Captures unrecognized novel skills into status='pending'
        with strict token validation, stopword filtration, O(1) pending index lookup,
        and bounded queue capacity (DoS defense).
        """
        if not raw_skill or not isinstance(raw_skill, str):
            return {}

        cleaned = raw_skill.strip()
        if not cleaned or len(cleaned) < 2 or len(cleaned) > 40:
            return {}

        # 1. Reject pure digits (e.g. '2024')
        if cleaned.isdigit():
            return {}

        # 2. Reject common generic resume prose words
        if cleaned.lower() in RESUME_PROSE_STOPWORDS:
            return {}

        # 3. Validate token format (must be plausible technical name)
        if not re.match(r"^[A-Za-z0-9][A-Za-z0-9\s.+#/_-]{0,38}[A-Za-z0-9+#]$", cleaned) and len(cleaned) > 1:
            return {}

        key = self._normalize_key(cleaned)
        if not key:
            return {}

        # 4. O(1) Pending index check (avoids scanning all skills O(N))
        if key in self._pending_index:
            pending_rec = self._pending_index[key]
            pending_rec["occurrence_count"] = pending_rec.get("occurrence_count", 1) + 1
            pending_rec["updated_at"] = datetime.now(timezone.utc).isoformat()
            return pending_rec

        # 5. If it already resolves to an approved record, return that
        existing = self.lookup_skill(cleaned)
        if existing and existing.get("status") == "approved":
            return existing

        # 6. Queue capacity limit (DoS / poisoning prevention)
        if len(self._pending_index) >= self.max_pending_skills:
            logger.warning(
                f"Flywheel pending review queue at capacity ({self.max_pending_skills}); "
                f"dropping candidate skill '{cleaned}' to protect system resources."
            )
            return {}

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
        self._pending_index[key] = pending_record
        logger.info(f"Flywheel registered new pending skill '{cleaned}' from source={source} (pending count: {len(self._pending_index)}).")
        return pending_record

    def create_skill(
        self,
        canonical_name: str,
        category: str,
        aliases: Optional[List[str]] = None,
        is_ambiguous: bool = False,
        source: str = "manual",
    ) -> Dict[str, Any]:
        """Creates a new canonical skill with collision validation."""
        cleaned_canonical = canonical_name.strip()
        if not cleaned_canonical:
            raise ValueError("Canonical skill name is required.")

        if len(self._skills_by_id) >= self.max_total_skills:
            raise ValueError(f"Taxonomy skills capacity reached ({self.max_total_skills}). Cannot add more skills.")

        self._check_canonical_collision(cleaned_canonical)

        cleaned_category = category.strip().lower()
        if not cleaned_category:
            raise ValueError("Category is required.")

        cleaned_aliases: List[str] = []
        if aliases:
            for alias in aliases:
                a_clean = alias.strip()
                if a_clean:
                    self._check_alias_collision(a_clean)
                    if a_clean not in cleaned_aliases:
                        cleaned_aliases.append(a_clean)

        new_id = f"skill-custom-{uuid.uuid4().hex[:8]}"
        record = {
            "id": new_id,
            "canonical_name": cleaned_canonical,
            "category": cleaned_category,
            "aliases": cleaned_aliases,
            "is_ambiguous": is_ambiguous,
            "status": "approved",
            "source": source,
            "occurrence_count": 1,
            "taxonomy_version": self.version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._register_record(record)
        return record

    def approve_skill(
        self,
        skill_id: str,
        canonical_name: Optional[str] = None,
        category: Optional[str] = None,
        aliases: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """Promotes a pending skill to approved canonical status with collision checks."""
        record = self._skills_by_id.get(skill_id)
        if not record:
            return None

        target_canonical = canonical_name.strip() if canonical_name else record["canonical_name"]
        if not target_canonical:
            raise ValueError("Canonical skill name cannot be empty.")

        # Check canonical collision against other skills
        self._check_canonical_collision(target_canonical, current_skill_id=record["id"])

        # Check alias collisions against other skills
        if aliases is not None:
            for alias in aliases:
                a_clean = alias.strip()
                if a_clean:
                    self._check_alias_collision(a_clean, current_skill_id=record["id"])

        # Remove from pending index
        old_canonical_key = self._normalize_key(record["canonical_name"])
        self._pending_index.pop(old_canonical_key, None)

        # Passed all checks! Now update record safely:
        self._remove_lookup_entries(record)
        record["canonical_name"] = target_canonical

        if category:
            record["category"] = category.strip().lower()

        if aliases is not None:
            combined = record.get("aliases", []) + [a.strip() for a in aliases if a.strip()]
            record["aliases"] = list(dict.fromkeys(combined))

        record["status"] = "approved"
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Refresh indexing
        self._register_record(record)
        return record

    def reject_skill(self, skill_id: str) -> Optional[Dict[str, Any]]:
        """Marks a pending skill as rejected (ignored) and removes from pending index."""
        record = self._skills_by_id.get(skill_id)
        if not record:
            return None

        canonical_key = self._normalize_key(record["canonical_name"])
        self._pending_index.pop(canonical_key, None)

        self._remove_lookup_entries(record)
        record["status"] = "rejected"
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        return record

    def add_alias(self, canonical_name_or_id: str, new_alias: str) -> Optional[Dict[str, Any]]:
        """Adds a new alias to an existing approved canonical skill with collision checks."""
        record = self.get_skill_by_canonical(canonical_name_or_id)
        if not record:
            record = self.get_skill_by_id(canonical_name_or_id)
        if not record:
            return None

        cleaned_alias = new_alias.strip()
        if not cleaned_alias:
            raise ValueError("Alias cannot be empty.")

        # Check alias collision against other skills
        self._check_alias_collision(cleaned_alias, current_skill_id=record["id"])

        if cleaned_alias not in record["aliases"]:
            record["aliases"].append(cleaned_alias)
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
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

    def get_pending_skills(self) -> List[Dict[str, Any]]:
        """Returns all currently pending skills in the flywheel review queue."""
        return list(self._pending_index.values())

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
