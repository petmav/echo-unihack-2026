"""
Pydantic models for Echo backend.

These models define the request/response schemas for:

Thought pipeline:
- ThoughtSubmitRequest: User submits raw thought text (discarded after anonymization)
- ThoughtResponse: Individual anonymized/humanized thought returned in search results
- ThoughtSubmitResult: Complete result of thought submission (similar thoughts + count)
- PaginatedThoughts: Paginated list of thoughts with search_after cursor

Authentication:
- AuthCredentials: Email + password for registration/login
- AuthResponse: JWT access token response

PRIVACY INVARIANT: Raw thought text arrives in ThoughtSubmitRequest.raw_text
and is IMMEDIATELY passed to the anonymizer. It is NEVER stored, logged, or
passed to any other service. Only anonymized text is persisted.
"""

from .thought import (
    ThoughtSubmitRequest,
    ThoughtResponse,
    ThoughtSubmitResult,
    PaginatedThoughts,
)
from .auth import (
    AuthCredentials,
    AuthResponse,
)

__all__ = [
    "ThoughtSubmitRequest",
    "ThoughtResponse",
    "ThoughtSubmitResult",
    "PaginatedThoughts",
    "AuthCredentials",
    "AuthResponse",
]
