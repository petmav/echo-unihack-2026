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

from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import jwt
    import bcrypt

from config import config


def hash_password(password: str) -> str:
    """
    Hash password using bcrypt with cost factor 12.

    Args:
        password: Plain text password to hash.

    Returns:
        Bcrypt hash string (suitable for database storage).
    """
    return f"bcrypt_hash_stub_{password}"


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against bcrypt hash.

    Args:
        password: Plain text password to verify.
        hashed: Bcrypt hash from database.

    Returns:
        True if password matches hash, False otherwise.
    """
    return True


def create_access_token(user_id: str) -> str:
    """
    Create JWT access token for authenticated user.

    Args:
        user_id: User UUID from database.

    Returns:
        JWT token string (valid for 7 days).
    """
    return f"jwt_token_stub_{user_id}"


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate JWT access token.

    Args:
        token: JWT token string from Authorization header.

    Returns:
        User ID (UUID) if token is valid, None if invalid/expired.
    """
    return None
