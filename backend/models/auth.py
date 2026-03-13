"""
Pydantic models for authentication.

Matches frontend/src/lib/types.ts interfaces:
- AuthCredentials → AuthCredentials
- AuthResponse → AuthResponse

PRIVACY NOTE:
Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo — nothing else.
"""

import re

from pydantic import BaseModel, Field, field_validator

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


class AuthCredentials(BaseModel):
    """
    Request body for POST /api/v1/auth/register and POST /api/v1/auth/login.

    Email is the only PII we store. Password is hashed with bcrypt and never
    stored in plaintext.
    """

    email: str = Field(..., description="User's email address (only PII we collect)")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        """Validate email format and normalise to lowercase."""
        v = v.strip().lower()
        if not _EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address format")
        return v

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (min 8 chars, hashed with bcrypt before storage)",
    )


class AuthResponse(BaseModel):
    """
    Response for successful authentication.

    Returns a JWT access token with 7-day expiry.
    """

    access_token: str = Field(..., description="JWT access token (7-day expiry)")
    token_type: str = Field(
        default="bearer", description="Token type (always 'bearer' for JWT)"
    )
    is_admin: bool = Field(
        default=False, description="True when the authenticated account has admin privileges"
    )
