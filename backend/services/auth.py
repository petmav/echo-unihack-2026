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

from datetime import UTC, datetime, timedelta

import bcrypt
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError

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


def create_access_token(user_id: str, is_admin: bool = False) -> str:
    """
    Create JWT access token for authenticated user.

    Args:
        user_id: User UUID from database.
        is_admin: Whether the user has admin privileges.

    Returns:
        JWT token string (valid for 7 days).
    """
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=config.JWT_EXPIRATION_DAYS),
        "adm": is_admin,
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str | None) -> str | None:
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
        user_id: str | None = payload.get("sub")
        return user_id
    except (JWTError, JWTClaimsError, ExpiredSignatureError):
        return None


def decode_access_token_admin(token: str | None) -> tuple[str | None, bool]:
    """
    Decode JWT and return (user_id, is_admin).

    Returns:
        (None, False) if token is invalid or missing.
    """
    if not token:
        return None, False
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        user_id: str | None = payload.get("sub")
        is_admin: bool = bool(payload.get("adm", False))
        return user_id, is_admin
    except (JWTError, JWTClaimsError, ExpiredSignatureError):
        return None, False
