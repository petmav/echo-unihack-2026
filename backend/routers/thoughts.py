"""
Thoughts router: POST /thoughts, GET /thoughts/similar, GET /thoughts/aggregates

PRIVACY CRITICAL:
- Raw thought text in POST body is anonymized IMMEDIATELY
- NEVER logged, NEVER persisted to disk
- Only anonymized + humanized output reaches Elasticsearch
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from models.thought import (
    ThoughtSubmitRequest,
    ThoughtSubmitResult,
    PaginatedThoughts,
    ThoughtResponse,
)

router = APIRouter(prefix="/thoughts", tags=["thoughts"])


@router.post("", response_model=ThoughtSubmitResult)
async def submit_thought(request: ThoughtSubmitRequest):
    """
    Submit a new thought for anonymization, humanization, and matching.

    Flow:
    1. Receive raw thought text (NEVER persisted)
    2. Anonymize with SLM 0.6B (strip PII, preserve emotion)
    3. Humanize with Claude (anonymized text only)
    4. Index in Elasticsearch with semantic embedding
    5. Find similar thoughts
    6. Return theme, match count, and first page of results

    PRIVACY: raw_text is discarded after anonymization. Only anonymized
    + humanized text is stored.
    """
    # TODO: Implement thought submission pipeline
    # 1. Call services.anonymiser.anonymize(request.raw_text)
    # 2. Call services.ai.humanize(anonymized_text)
    # 3. Call services.ai.classify_theme(anonymized_text)
    # 4. Call services.elastic.index_thought(...)
    # 5. Call services.elastic.find_similar(...)
    # 6. Return ThoughtSubmitResult

    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/similar", response_model=PaginatedThoughts)
async def get_similar_thoughts(
    message_id: str = Query(..., description="Message ID to find similar thoughts for"),
    size: int = Query(20, ge=1, le=100, description="Number of results per page"),
    search_after: Optional[str] = Query(
        None, description="Elasticsearch search_after cursor (JSON array)"
    ),
):
    """
    Get paginated similar thoughts for infinite scroll.

    Uses Elasticsearch search_after for efficient deep pagination.

    PRIVACY: Returns only anonymized/humanized thoughts with no user linkage.
    """
    # TODO: Implement pagination
    # 1. Parse search_after JSON if provided
    # 2. Call services.elastic.find_similar_paginated(...)
    # 3. Return PaginatedThoughts with next search_after cursor

    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/aggregates", response_model=list[dict])
async def get_theme_aggregates():
    """
    Get weekly aggregate counts per theme for "Breathing With Others" feature.

    Returns anonymous counts like [{"theme": "work_stress", "count": 127}, ...]

    PRIVACY: Aggregate counts only, no user IDs, no individual tracking.
    """
    # TODO: Implement aggregates
    # 1. Call services.elastic.get_weekly_theme_counts()
    # 2. Return list of {theme, count} dicts

    raise HTTPException(status_code=501, detail="Not implemented")
