"""
Account router: DELETE /account

Handles account deletion (GDPR compliance).

PRIVACY: Deletes only server-side data (email + password hash + theme linkages).
Device-stored data (raw thoughts, history, trends, Future You letters) is cleared
client-side via localStorage.clear().
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional

router = APIRouter(prefix="/account", tags=["account"])


@router.delete("", response_model=dict)
async def delete_account(authorization: Optional[str] = Header(None)):
    """
    Delete user account and all associated server-side data.

    Removes:
    - Email + password hash from database
    - All theme linkages (account_id -> message_id mappings)

    Does NOT remove:
    - Anonymized thoughts in Elasticsearch (no user linkage exists)
    - Device-stored raw thoughts (handled client-side)

    PRIVACY: After deletion, no server-side link between email and thoughts remains.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    raise HTTPException(status_code=501, detail="Not implemented")
