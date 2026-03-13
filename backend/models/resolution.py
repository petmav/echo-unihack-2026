"""
Pydantic models for resolution ("what helped") flow.

Matches frontend/src/lib/types.ts interfaces:
- ResolutionSubmit → ResolutionSubmit

Additional backend-only models:
- ResolutionResponse: Response model for resolution submission

PRIVACY NOTE:
Resolution text (advice from users who resolved similar issues) goes through
the same Anonymizer SLM 0.6B pass to strip PII while preserving specificity.
It is then stored verbatim in Elasticsearch and shown verbatim to users.

CRITICAL: We never paraphrase or summarize resolution text with AI, as
misconstrued advice on mental health issues is a real harm. Typos are not.
"""

from pydantic import BaseModel, Field


class ResolutionSubmit(BaseModel):
    """
    Request body for POST /api/v1/resolution.

    Submitted when a user marks a thought as resolved and shares what helped.

    WARNING: resolution_text may contain PII and must be anonymized before storage.
    """

    message_id: str = Field(
        ..., description="ID of the thought being resolved (from local storage)"
    )
    resolution_text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User's advice on what helped. MUST be anonymized before storage.",
    )


class ResolutionResponse(BaseModel):
    """
    Response for POST /api/v1/resolution and GET /api/v1/resolution/{message_id}.

    Returns confirmation that resolution was stored, or retrieves existing resolution.
    """

    message_id: str = Field(
        ..., description="ID of the thought this resolution is attached to"
    )
    resolution_text: str = Field(
        ..., description="Anonymized 'what helped' text (shown verbatim)"
    )
    timestamp: int = Field(
        ..., description="Unix timestamp when resolution was submitted"
    )
