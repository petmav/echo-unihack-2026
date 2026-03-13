"""
Authentication service for JWT token management and password hashing.

Handles:
- Password hashing with bcrypt (cost factor 12)
- JWT token generation and validation
- Token refresh logic

PRIVACY NOTE:
Echo collects ONLY email + bcrypt password hash for authentication.
No name, no DOB, no phone number, no profile photo -- nothing else.

JWT tokens contain only:
- sub (subject): user_id (UUID)
- exp (expiration): 7 days from issue
- iat (issued at): timestamp

No sensitive data in JWT payload.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from config import config

# Bcrypt cost factor
_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """
    Hash password using bcrypt with cost factor 12.

    Args:
        password: Plain text password to hash.

    Returns:
        Bcrypt hash string (suitable for database storage).
    """
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against bcrypt hash.

    Args:
        password: Plain text password to verify.
        hashed: Bcrypt hash from database.

    Returns:
        True if password matches hash, False otherwise.
    """
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    """
    Create JWT access token for authenticated user.

    Args:
        user_id: User UUID from database.

    Returns:
        JWT token string (valid for 7 days).
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=config.JWT_EXPIRATION_DAYS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: Optional[str]) -> Optional[str]:
    """
    Decode and validate JWT access token.

    Args:
        token: JWT token string from Authorization header.

    Returns:
        User ID (UUID) if token is valid, None if invalid/expired/missing.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        return user_id
    except Exception:
        return None
