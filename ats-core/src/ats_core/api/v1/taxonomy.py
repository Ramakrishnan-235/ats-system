"""
taxonomy.py
REST API routes for Skills Taxonomy and Flywheel review queue.
Enforces role-based authorization, collision prevention, audit logging,
and public service method encapsulation.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query, Request
from pydantic import BaseModel, Field

from ats_core.api.auth import get_current_user
from ats_core.api.audit import audit_store
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
async def create_taxonomy_skill(payload: CreateSkillPayload, request: Request):
    """Creates a new canonical skill in the taxonomy (requires taxonomy manage permissions)."""
    user = get_current_user(request)
    if not user.can_manage_taxonomy():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to create taxonomy skills.",
        )

    service = SkillTaxonomyService.get_instance()
    try:
        new_skill = service.create_skill(
            canonical_name=payload.canonical_name,
            category=payload.category,
            aliases=payload.aliases,
            is_ambiguous=payload.is_ambiguous,
            source=payload.source,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action="taxonomy:create_skill",
        resource_type="skill",
        resource_id=new_skill["id"],
        decision="allow",
        details=f"Created canonical skill '{new_skill['canonical_name']}'",
    )
    return new_skill


@router.patch("/skills/{skill_id}/approve")
async def approve_taxonomy_skill(skill_id: str, request: Request, payload: Optional[ApproveSkillPayload] = None):
    """Promotes a pending flywheel skill to approved canonical status (requires taxonomy manage permissions)."""
    user = get_current_user(request)
    if not user.can_manage_taxonomy():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to approve taxonomy skills.",
        )

    service = SkillTaxonomyService.get_instance()
    try:
        res = service.approve_skill(
            skill_id=skill_id,
            canonical_name=payload.canonical_name if payload else None,
            category=payload.category if payload else None,
            aliases=payload.aliases if payload else None,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found.",
        )

    audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action="taxonomy:approve_skill",
        resource_type="skill",
        resource_id=skill_id,
        decision="allow",
        details=f"Approved skill '{res.get('canonical_name')}'",
    )
    return res


@router.patch("/skills/{skill_id}/reject")
async def reject_taxonomy_skill(skill_id: str, request: Request):
    """Rejects a pending flywheel skill (requires taxonomy manage permissions)."""
    user = get_current_user(request)
    if not user.can_manage_taxonomy():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to reject taxonomy skills.",
        )

    service = SkillTaxonomyService.get_instance()
    res = service.reject_skill(skill_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found.",
        )

    audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action="taxonomy:reject_skill",
        resource_type="skill",
        resource_id=skill_id,
        decision="allow",
        details=f"Rejected skill '{res.get('canonical_name')}'",
    )
    return res


@router.post("/skills/{skill_id}/aliases")
async def add_alias_to_skill(skill_id: str, payload: AddAliasPayload, request: Request):
    """Adds a new alias to an existing skill (requires taxonomy manage permissions)."""
    user = get_current_user(request)
    if not user.can_manage_taxonomy():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to add taxonomy aliases.",
        )

    service = SkillTaxonomyService.get_instance()
    skill = service.get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID '{skill_id}' not found.",
        )

    try:
        res = service.add_alias(skill["canonical_name"], payload.alias)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action="taxonomy:add_alias",
        resource_type="skill",
        resource_id=skill_id,
        decision="allow",
        details=f"Added alias '{payload.alias}' to skill '{skill['canonical_name']}'",
    )
    return res


@router.post("/sync-seed")
async def sync_seed_taxonomy(request: Request):
    """
    Synchronizes the taxonomy in-memory database with the curated seed data
    without overwriting approved edits or custom skills. Requires administrator privileges.
    """
    user = get_current_user(request)
    if not user.can_admin_taxonomy():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to administer taxonomy seed data. Administrator role is required.",
        )

    service = SkillTaxonomyService.get_instance()
    result = service.sync_seed()

    audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action="taxonomy:sync_seed",
        resource_type="taxonomy",
        resource_id="seed",
        decision="allow",
        details=f"Synced seed taxonomy (added: {result['added_count']}, updated: {result['updated_count']})",
    )
    return {
        "status": "SUCCESS",
        "message": f"Successfully synchronized seed taxonomy ontology (version {service.version}). Approved user edits and custom skills preserved.",
        "added_count": result["added_count"],
        "updated_count": result["updated_count"],
        "stats": result["stats"],
    }
