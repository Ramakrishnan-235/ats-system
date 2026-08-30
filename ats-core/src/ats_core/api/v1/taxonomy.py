"""
taxonomy.py
REST API routes for Skills Taxonomy and Flywheel review queue.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService

router = APIRouter(prefix="/taxonomy", tags=["Skill Taxonomy & Flywheel"])


class CreateSkillPayload(BaseModel):
    canonical_name: str = Field(..., description="Canonical standard name (e.g. 'PostgreSQL').")
    category: str = Field(..., description="Category (language|framework|database|platform|tool|library|domain|soft_skill).")
    aliases: List[str] = Field(default_factory=list, description="Array of alternative names or abbreviations.")
    is_ambiguous: bool = Field(default=False, description="Whether this is a short token needing exact matching.")
    source: str = Field(default="manual", description="Source (lightcast|esco|onet|stackoverflow|llm|resume_parser|manual).")


class ApproveSkillPayload(BaseModel):
    canonical_name: Optional[str] = None
    category: Optional[str] = None
    aliases: Optional[List[str]] = None


class AddAliasPayload(BaseModel):
    alias: str = Field(..., description="New alias to associate with this canonical skill.")


@router.get("/version")
async def get_taxonomy_version():
    """Returns the active taxonomy version and aggregate overview metrics."""
    service = SkillTaxonomyService.get_instance()
    stats = service.get_taxonomy_stats()
    return stats


@router.get("/skills")
async def list_taxonomy_skills(
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status (approved|pending|rejected|all)"),
    search: Optional[str] = Query(None, description="Search keyword in canonical name, aliases, or source"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Lists taxonomy skills with filtering, search, and pagination."""
    service = SkillTaxonomyService.get_instance()
    items, total = service.list_skills(
        category=category,
        status=status,
        search=search,
        page=page,
        limit=limit
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "version": service.version
    }


@router.post("/skills", status_code=status.HTTP_201_CREATED)
async def create_taxonomy_skill(payload: CreateSkillPayload):
    """Creates a new canonical skill in the taxonomy."""
    service = SkillTaxonomyService.get_instance()
    existing = service.get_skill_by_canonical(payload.canonical_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Canonical skill '{payload.canonical_name}' already exists in taxonomy."
        )

    new_skill = {
        "id": f"skill-custom-{uuid_hex()}",
        "canonical_name": payload.canonical_name.strip(),
        "category": payload.category.strip().lower(),
        "aliases": [a.strip() for a in payload.aliases if a.strip()],
        "is_ambiguous": payload.is_ambiguous,
        "status": "approved",
        "source": payload.source,
        "occurrence_count": 1,
        "taxonomy_version": service.version,
        "created_at": datetime_now_iso(),
        "updated_at": datetime_now_iso(),
    }
    service._register_record(new_skill)
    return new_skill


@router.patch("/skills/{skill_id}/approve")
async def approve_taxonomy_skill(skill_id: str, payload: Optional[ApproveSkillPayload] = None):
    """Promotes a pending flywheel skill to approved canonical status."""
    service = SkillTaxonomyService.get_instance()
    res = service.approve_skill(
        skill_id=skill_id,
        canonical_name=payload.canonical_name if payload else None,
        category=payload.category if payload else None,
        aliases=payload.aliases if payload else None
    )
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found."
        )
    return res


@router.patch("/skills/{skill_id}/reject")
async def reject_taxonomy_skill(skill_id: str):
    """Rejects a pending flywheel skill."""
    service = SkillTaxonomyService.get_instance()
    res = service.reject_skill(skill_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found."
        )
    return res


@router.post("/skills/{skill_id}/aliases")
async def add_alias_to_skill(skill_id: str, payload: AddAliasPayload):
    """Adds a new alias to an existing skill."""
    service = SkillTaxonomyService.get_instance()
    skill = service.get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found."
        )

    res = service.add_alias(skill["canonical_name"], payload.alias)
    return res


@router.post("/sync-seed")
async def sync_seed_taxonomy():
    """Resets or syncs the taxonomy in-memory database with the curated seed data."""
    service = SkillTaxonomyService.get_instance()
    service._seed_taxonomy()
    return {
        "status": "SUCCESS",
        "message": f"Successfully re-synced seed taxonomy ontology (version {service.version}).",
        "stats": service.get_taxonomy_stats()
    }


def uuid_hex() -> str:
    import uuid
    return uuid.uuid4().hex[:8]


def datetime_now_iso() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat()
