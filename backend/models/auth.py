"""
Pydantic models for authentication.

Matches frontend/src/lib/types.ts interfaces:
- AuthCredentials → AuthCredentials
- AuthResponse → AuthResponse

PRIVACY NOTE:
Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo — nothing else.
"""

from pydantic import BaseModel, Field


class AuthCredentials(BaseModel):
    """
    Request body for POST /api/v1/auth/register and POST /api/v1/auth/login.

    Email is the only PII we store. Password is hashed with bcrypt and never
    stored in plaintext.
    """

    email: str = Field(..., description="User's email address (only PII we collect)")
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
