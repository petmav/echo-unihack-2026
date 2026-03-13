"""
Auth router: POST /auth/register, POST /auth/login, POST /auth/refresh

Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo — nothing else.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional

from models.auth import AuthCredentials, AuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(credentials: AuthCredentials):
    """
    Register a new user account.

    Creates account with:
    - Email (only PII we collect)
    - bcrypt-hashed password

    Returns JWT access token (7-day expiry).
    """
    # TODO: Implement registration
    # 1. Validate email format
    # 2. Check if email already exists
    # 3. Hash password with bcrypt
    # 4. Insert into database
    # 5. Generate JWT token
    # 6. Return AuthResponse

    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/login", response_model=AuthResponse)
async def login(credentials: AuthCredentials):
    """
    Authenticate existing user.

    Validates email + password, returns JWT access token.
    """
    # TODO: Implement login
    # 1. Look up user by email
    # 2. Verify password with bcrypt
    # 3. Generate JWT token
    # 4. Return AuthResponse

    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(authorization: Optional[str] = Header(None)):
    """
    Refresh JWT token before expiry.

    Requires valid existing JWT in Authorization header.
    Returns new JWT with extended expiry.
    """
    # TODO: Implement token refresh
    # 1. Extract and validate current JWT from Authorization header
    # 2. Extract user_id from token
    # 3. Generate new JWT token
    # 4. Return AuthResponse

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    raise HTTPException(status_code=501, detail="Not implemented")
