"""
Auth router: POST /auth/register, POST /auth/login, POST /auth/refresh

Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo -- nothing else.

Backed by PostgreSQL via SQLAlchemy async (asyncpg driver).
"""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import config
from database import Account, get_async_db
from middleware.rate_limit import make_rate_limit_dependency
from models.auth import AuthCredentials, AuthResponse
from services.auth import (
    create_access_token,
    decode_access_token_admin,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# 5 login attempts per 15 minutes (900 seconds), keyed by IP
login_rate_limit = make_rate_limit_dependency(
    max_requests=5,
    window_seconds=900,
    key_prefix="login",
)


@router.post("/register", response_model=AuthResponse)
async def register(
    credentials: AuthCredentials,
    db: AsyncSession = Depends(get_async_db),
):
    """Register a new user account. Returns JWT access token (7-day expiry)."""
    result = await db.execute(select(Account).where(Account.email == credentials.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    account = Account(
        id=user_id,
        email=credentials.email,
        password_hash=hash_password(credentials.password),
    )
    db.add(account)
    await db.commit()

    is_admin = bool(config.ADMIN_EMAIL and credentials.email == config.ADMIN_EMAIL)
    token = create_access_token(user_id, is_admin=is_admin)
    return AuthResponse(access_token=token, is_admin=is_admin)


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: AuthCredentials,
    db: AsyncSession = Depends(get_async_db),
    _: None = Depends(login_rate_limit),
):
    """Authenticate existing user. Returns JWT access token."""
    result = await db.execute(select(Account).where(Account.email == credentials.email))
    account = result.scalar_one_or_none()
    if account is None or not verify_password(credentials.password, account.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    is_admin = bool(config.ADMIN_EMAIL and account.email == config.ADMIN_EMAIL)
    token = create_access_token(account.id, is_admin=is_admin)
    return AuthResponse(access_token=token, is_admin=is_admin)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(authorization: str | None = Header(None)):
    """Refresh JWT token before expiry."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    user_id, was_admin = decode_access_token_admin(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    new_token = create_access_token(user_id, is_admin=was_admin)
    return AuthResponse(access_token=new_token, is_admin=was_admin)
