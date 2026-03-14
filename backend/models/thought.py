"""
Pydantic models for the thought pipeline.

Matches frontend/src/lib/types.ts interfaces:
- ThoughtResponse → ThoughtResponse
- ThoughtSubmitResult → ThoughtSubmitResult
- PaginatedThoughts → PaginatedThoughts

Additional backend-only models:
- ThoughtSubmitRequest: Input model for POST /api/v1/thoughts
- ThemeAggregateResponse: Response model for GET /api/v1/thoughts/aggregates

CRITICAL PRIVACY NOTE:
ThoughtSubmitRequest.text contains the user's original thought.
This text MUST be:
1. Passed IMMEDIATELY to the anonymizer service
2. NEVER written to disk, logs, or any persistent storage
3. NEVER passed to Claude or any external API
4. Discarded after anonymization completes

Only the anonymized + humanized output is stored in Elasticsearch.
"""


from pydantic import BaseModel, Field, field_validator


class ThoughtSubmitRequest(BaseModel):
    """
    Request body for POST /api/v1/thoughts.

    WARNING: text contains PII and sensitive mental health content.
    It MUST be anonymized immediately and NEVER persisted.
    """

    text: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Raw user thought text. NEVER persisted. Anonymized immediately.",
    )

    @field_validator("text")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        """Strip leading/trailing whitespace and normalize internal whitespace."""
        return " ".join(v.split())


class ThoughtResponse(BaseModel):
    """
    Individual thought returned in search results.

    Contains ONLY anonymized/humanized content. No user identifiers.
    Corresponds to a document in Elasticsearch echo-thoughts index.
    """

    message_id: str = Field(..., description="Unique identifier for this thought")
    humanised_text: str = Field(
        ..., description="Claude-humanised version of anonymized thought"
    )
    theme_category: str = Field(
        ..., description="Classified emotional theme (e.g., 'work_stress', 'self_harm')"
    )
    has_resolution: bool = Field(
        ..., description="Whether this thought has 'what helped' advice attached"
    )
    resolution_text: str | None = Field(
        None, description="Verbatim 'what helped' text if has_resolution is True"
    )
    similarity_score: float | None = Field(
        None,
        description="Elasticsearch similarity score (0-1). Used for match strength labels.",
    )


class ThoughtSubmitResult(BaseModel):
    """
    Complete response for POST /api/v1/thoughts.

    Returns the submitted thought's metadata plus similar thoughts from others.
    """

    message_id: str = Field(
        ..., description="ID of the newly submitted thought (for local storage)"
    )
    theme_category: str = Field(
        ..., description="Classified theme (stored locally for Future You letters)"
    )
    match_count: int = Field(
        ..., description="Total number of similar thoughts found (for count reveal)"
    )
    similar_thoughts: list[ThoughtResponse] = Field(
        ..., description="First page of similar thoughts (10-20 items)"
    )
    search_after: list | None = Field(
        None,
        description="Elasticsearch search_after cursor for pagination (opaque to frontend)",
    )


class PaginatedThoughts(BaseModel):
    """
    Paginated response for GET /api/v1/thoughts/similar.

    Used for infinite scroll on response cards.
    """

    thoughts: list[ThoughtResponse] = Field(..., description="Page of thought results")
    search_after: list | None = Field(
        None, description="Cursor for next page (None if no more results)"
    )
    total: int = Field(
        ..., description="Total count of matching thoughts (not necessarily all loaded)"
    )


class ThemeAggregateResponse(BaseModel):
    """
    Single theme aggregate count for GET /api/v1/thoughts/aggregates.

    Used by the "Breathing With Others" ambient co-presence feature.

    PRIVACY: Aggregate counts only. No user IDs, no individual tracking.
    """

    theme: str = Field(
        ..., description="Emotional theme category (e.g., 'work_stress', 'anxiety')"
    )
    count: int = Field(
        ..., description="Number of thoughts submitted in this theme this week"
    )
    resolution_count: int = Field(
        ...,
        description="Number of thoughts in this theme this week that have shared 'what helped'",
    )
    resolution_rate: int = Field(
        ...,
        description="Percentage of thoughts in this theme this week with shared 'what helped'",
    )


class ThemeCountResponse(BaseModel):
    """
    Aggregate all-time stats for a single theme.

    Used on the results screen to show how many people in this emotional
    space later shared what helped.
    """

    theme: str = Field(
        ..., description="Emotional theme category (e.g., 'work_stress', 'anxiety')"
    )
    count: int = Field(
        ..., description="All-time number of thoughts submitted in this theme"
    )
    resolution_count: int = Field(
        ...,
        description="All-time number of thoughts in this theme that have shared 'what helped'",
    )
    resolution_rate: int = Field(
        ...,
        description="Percentage of all-time thoughts in this theme with shared 'what helped'",
    )
