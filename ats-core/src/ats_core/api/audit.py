import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import Request, HTTPException, status
from ats_core.api.auth import UserIdentity

logger = logging.getLogger("ats.api.audit")


@dataclass
class AuditRecord:
    id: str
    timestamp: str
    actor_id: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: str
    decision: str  # "ALLOWED" or "DENIED"
    details: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    def to_dict(self):
        return asdict(self)


class PIIAuditLogger:
    def __init__(self, max_entries: int = 10000):
        self.max_entries = max_entries
        self._entries: List[AuditRecord] = []

    def record(
        self,
        actor_id: str,
        actor_role: str,
        action: str,
        resource_type: str,
        resource_id: str,
        decision: str,
        details: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditRecord:
        record = AuditRecord(
            id=f"aud-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            actor_id=actor_id or "anonymous",
            actor_role=actor_role or "unknown",
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            decision=decision,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._entries.append(record)
        if len(self._entries) > self.max_entries:
            self._entries.pop(0)

        log_level = logging.WARNING if decision == "DENIED" else logging.INFO
        logger.log(
            log_level,
            "AUDIT [%s] actor=%s role=%s action=%s target=%s:%s details=%s",
            decision, record.actor_id, record.actor_role, action, resource_type, resource_id, details
        )
        return record

    def list_records(
        self,
        limit: int = 50,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
    ) -> List[AuditRecord]:
        results = list(self._entries)
        if actor_id:
            results = [r for r in results if r.actor_id.lower() == actor_id.lower()]
        if action:
            results = [r for r in results if r.action.lower() == action.lower()]
        if resource_type:
            results = [r for r in results if r.resource_type.lower() == resource_type.lower()]
        results.reverse()
        return results[:limit]

    def clear(self):
        self._entries.clear()


audit_store = PIIAuditLogger()


def log_pii_access(
    request: Request,
    user: UserIdentity,
    action: str,
    resource_type: str,
    resource_id: str,
    decision: str,
    details: str,
) -> AuditRecord:
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return audit_store.record(
        actor_id=user.user_id,
        actor_role=user.role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        decision=decision,
        details=details,
        ip_address=client_ip,
        user_agent=user_agent,
    )


def check_and_audit_pii_access(
    request: Request,
    user: UserIdentity,
    action: str,
    resource_type: str,
    resource_id: str = "all",
) -> None:
    """
    Checks if current user identity has permission to view unmasked PII.
    If authorized, logs an ALLOWED audit record.
    If unauthorized, logs a DENIED audit record and raises HTTP 403 Forbidden.
    """
    if not user.can_view_pii():
        log_pii_access(
            request=request,
            user=user,
            action=f"{action}_DENIED",
            resource_type=resource_type,
            resource_id=resource_id,
            decision="DENIED",
            details=f"Role '{user.role}' is not authorized to view unmasked personal data (PII).",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{user.role}' is not authorized to view unmasked personal data (PII). An authorized role (e.g. recruiter, admin) is required.",
        )

    log_pii_access(
        request=request,
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        decision="ALLOWED",
        details="Authorized access to unmasked personal data (PII).",
    )
