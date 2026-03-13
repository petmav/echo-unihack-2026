"""
Auth router: POST /auth/register, POST /auth/login, POST /auth/refresh

Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo -- nothing else.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from models.auth import AuthCredentials, AuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(credentials: AuthCredentials):
    """Register a new user account. Returns JWT access token (7-day expiry)."""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/login", response_model=AuthResponse)
async def login(credentials: AuthCredentials):
    """Authenticate existing user. Returns JWT access token."""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(authorization: Optional[str] = Header(None)):
    """Refresh JWT token before expiry."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    raise HTTPException(status_code=501, detail="Not implemented")
