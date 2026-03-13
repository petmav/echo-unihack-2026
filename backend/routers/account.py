"""
Account router: DELETE /account

Handles account deletion (GDPR compliance).

PRIVACY: Deletes only server-side data (email + password hash + theme linkages).
Device-stored data (raw thoughts, history, trends, Future You letters) is cleared
client-side via localStorage.clear().
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.orm import Session
from typing import Optional

from services import auth as auth_service
from database import get_db, Account, MessageTheme

router = APIRouter(prefix="/account", tags=["account"])


@router.delete("", response_model=dict)
async def delete_account(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
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

    token = authorization.removeprefix("Bearer ")
    user_id = auth_service.decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    account = db.query(Account).filter(Account.id == user_id).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    db.query(MessageTheme).filter(MessageTheme.account_id == user_id).delete()
    db.delete(account)
    db.commit()

    return {"deleted": True, "user_id": user_id}
