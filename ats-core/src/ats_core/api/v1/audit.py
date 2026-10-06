from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import List, Optional
from ats_core.api.auth import get_current_user
from ats_core.api.audit import audit_store, AuditRecord

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/logs")
async def get_audit_logs(
    request: Request,
    limit: int = Query(50, ge=1, le=1000),
    actor_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
):
    user = get_current_user(request)
    if not user.can_view_audit():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to view audit logs.",
        )
    return audit_store.list_records(
        limit=limit,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
    )
