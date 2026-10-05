"""Deterministic UUID conversion utilities for candidate, job, and application IDs."""

import uuid
from typing import Any, Optional

# Stable namespace UUID for deterministic UUIDv5 generation from custom string IDs
ATS_NAMESPACE = uuid.UUID("a3bb189e-8bf9-3888-9912-ace4e6543002")


def coerce_to_uuid(val: Any) -> uuid.UUID:
    """
    Deterministically convert any candidate, job, or application ID into a valid uuid.UUID.

    Supports:
    - Existing uuid.UUID instances
    - Standard 36-character UUID strings (with dashes)
    - 32-character hexadecimal UUID strings
    - Prefixed IDs where the remainder is a UUID/hex (e.g. "cand-<hex32>", "cand-<uuid36>", "job-<hex32>", "app-<hex32>")
    - Non-hex custom string IDs (e.g. "job-001", "job-1", "job-open", "cand-1") deterministically via UUIDv5.

    Raises:
        ValueError: If val is None, empty, or cannot be parsed.
    """
    if val is None:
        raise ValueError("ID cannot be None")
    if isinstance(val, uuid.UUID):
        return val

    s = str(val).strip()
    if not s:
        raise ValueError("ID cannot be empty")

    # 1. Direct standard UUID parse
    try:
        return uuid.UUID(s)
    except (ValueError, AttributeError):
        pass

    # 2. Strip known prefixes (cand-, job-, app-) and attempt direct UUID parse
    for prefix in ("cand-", "job-", "app-"):
        if s.startswith(prefix):
            remainder = s[len(prefix):]
            try:
                return uuid.UUID(remainder)
            except (ValueError, AttributeError):
                pass

    # 3. Deterministic UUIDv5 for arbitrary string IDs like "job-001", "cand-1", etc.
    return uuid.uuid5(ATS_NAMESPACE, s)


def optional_coerce_to_uuid(val: Any) -> Optional[uuid.UUID]:
    """Coerce to UUID if val is provided, else return None."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    return coerce_to_uuid(s)
