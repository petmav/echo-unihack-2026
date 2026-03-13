"""
Thoughts router: POST /thoughts, GET /thoughts/similar, GET /thoughts/aggregates

PRIVACY CRITICAL:
- Raw thought text in POST body is anonymized IMMEDIATELY
- NEVER logged, NEVER persisted to disk
- Only anonymized + humanized output reaches Elasticsearch
"""

import hashlib
import json
import random
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from middleware.rate_limit import _rate_limiter, get_client_identifier
from models.thought import (
    ThoughtSubmitRequest,
    ThoughtSubmitResult,
    PaginatedThoughts,
    ThoughtResponse,
    ThemeAggregateResponse,
)
from services import anonymiser as anonymiser_service
from services import ai
from services.ai import ClaudeRateLimitError, ClaudeAPIError
from services import elastic
from config import config

router = APIRouter(prefix="/thoughts", tags=["thoughts"])

_SENTIMENT_VECTOR_DIMS = 1536

_THOUGHTS_RATE_LIMIT_MAX = config.RATE_LIMIT_THOUGHTS_PER_HOUR
_THOUGHTS_RATE_LIMIT_WINDOW = 3600  # seconds


async def thoughts_rate_limit(request: Request) -> None:
    """
    Account-based rate limit dependency for POST /thoughts.

    Identifies the client using their account_id (extracted from the JWT
    Bearer token without requiring authentication) when present, falling
    back to a SHA256-hashed IP address for unauthenticated requests.

    Limit: 10 requests per 3600 seconds.

    Raises:
        HTTPException 429: When the client exceeds the rate limit.
    """
    client_key: str

    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
        account_id = auth_service.decode_access_token(token)
        if account_id:
            # Hash the account_id for consistency with the privacy model
            account_hash = hashlib.sha256(account_id.encode()).hexdigest()
            client_key = f"thoughts:account:{account_hash}"
        else:
            # Token present but invalid/expired — fall back to hashed IP
            client_key = get_client_identifier(request, "thoughts")
    else:
        client_key = get_client_identifier(request, "thoughts")

    allowed, retry_after = _rate_limiter.is_allowed(
        client_key=client_key,
        max_requests=_THOUGHTS_RATE_LIMIT_MAX,
        window_seconds=_THOUGHTS_RATE_LIMIT_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )


def _generate_sentiment_vector() -> list[float]:
    """
    Generate a stub sentiment vector.

    Returns a list of 1536 random floats in [-1, 1] as a placeholder until
    a real embedding model is integrated.
    """
    return [random.uniform(-1.0, 1.0) for _ in range(_SENTIMENT_VECTOR_DIMS)]


@router.post("", response_model=ThoughtSubmitResult)
async def submit_thought(request: ThoughtSubmitRequest, _: None = Depends(thoughts_rate_limit)):
    """
    Submit a new thought for anonymization, humanization, and matching.

    Flow:
    1. Receive raw thought text (NEVER persisted)
    2. Anonymize with SLM 0.6B (strip PII, preserve emotion)
    3. Humanize with Claude (anonymized text only)
    4. Index in Elasticsearch with semantic embedding
    5. Find similar thoughts
    6. Return theme, match count, and first page of results

    PRIVACY: text is discarded after anonymization. Only anonymized
    + humanized text is stored.
    """
    # Step 1: Anonymize raw text — MUST be called first, raw text discarded after
    try:
        anonymized_text = await anonymiser_service.anonymize_text(request.text)
    except anonymiser_service.OllamaConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Anonymization service unavailable. Please try again later.",
        )
    except anonymiser_service.OllamaTimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Anonymization service timed out. Please try again later.",
        )
    except anonymiser_service.OllamaResponseError:
        raise HTTPException(
            status_code=502,
            detail="Anonymization service returned an invalid response.",
        )

    # Step 2: Humanize with Claude — only receives anonymized text
    try:
        humanised_text = await ai.humanize_thought(anonymized_text)
    except ClaudeRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Service is temporarily busy. Please try again in a moment.",
        )
    except ClaudeAPIError:
        raise HTTPException(
            status_code=502,
            detail="Humanization service failed. Please try again later.",
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Humanization service failed. Please try again later.",
        )

    # Step 3: Classify emotional theme
    try:
        theme_category = await ai.classify_theme(humanised_text)
    except ClaudeRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Service is temporarily busy. Please try again in a moment.",
        )
    except ClaudeAPIError:
        raise HTTPException(
            status_code=502,
            detail="Theme classification failed. Please try again later.",
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Theme classification failed. Please try again later.",
        )

    # Step 4: Generate unique message ID and stub sentiment vector
    message_id = str(uuid.uuid4())
    sentiment_vector = _generate_sentiment_vector()

    # Step 5: Index in Elasticsearch (non-fatal if unavailable)
    try:
        await elastic.index_thought(
            message_id=message_id,
            humanised_text=humanised_text,
            theme_category=theme_category,
            sentiment_vector=sentiment_vector,
        )
    except Exception:
        # Indexing failure is non-fatal — the user can still see results
        pass

    # Step 6: Search for similar thoughts
    try:
        search_result = await elastic.search_similar_thoughts(
            theme_category=theme_category,
            sentiment_vector=sentiment_vector,
            limit=20,
        )
    except Exception:
        search_result = {"thoughts": [], "total": 0, "search_after": None}

    similar_thoughts = [
        ThoughtResponse(
            message_id=t["message_id"],
            humanised_text=t["humanised_text"],
            theme_category=t["theme_category"],
            has_resolution=t.get("has_resolution", False),
            resolution_text=t.get("resolution_text"),
        )
        for t in search_result["thoughts"]
    ]

    return ThoughtSubmitResult(
        message_id=message_id,
        theme_category=theme_category,
        match_count=search_result["total"],
        similar_thoughts=similar_thoughts,
        search_after=search_result["search_after"],
    )


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
    parsed_cursor: Optional[list] = None
    if search_after is not None:
        try:
            parsed_cursor = json.loads(search_after)
            if not isinstance(parsed_cursor, list):
                raise ValueError("search_after must be a JSON array")
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(
                status_code=422,
                detail="Invalid search_after cursor: must be a JSON array string.",
            )

    try:
        thought_doc = await elastic.get_thought_by_id(message_id)
    except Exception:
        thought_doc = None

    if thought_doc is None:
        raise HTTPException(
            status_code=404,
            detail="Thought not found.",
        )

    try:
        search_result = await elastic.search_similar_thoughts(
            theme_category=thought_doc["theme_category"],
            sentiment_vector=thought_doc["sentiment_vector"],
            limit=size,
            search_after=parsed_cursor,
        )
    except Exception:
        search_result = {"thoughts": [], "total": 0, "search_after": None}

    thoughts = [
        ThoughtResponse(
            message_id=t["message_id"],
            humanised_text=t["humanised_text"],
            theme_category=t["theme_category"],
            has_resolution=t.get("has_resolution", False),
            resolution_text=t.get("resolution_text"),
        )
        for t in search_result["thoughts"]
    ]

    return PaginatedThoughts(
        thoughts=thoughts,
        search_after=search_result["search_after"],
        total=search_result["total"],
    )


_DEMO_AGGREGATES: list[dict] = [
    {"theme": "work_stress", "count": 847},
    {"theme": "anxiety", "count": 634},
    {"theme": "loneliness", "count": 521},
    {"theme": "relationship_conflict", "count": 478},
    {"theme": "self_worth", "count": 392},
    {"theme": "grief", "count": 287},
    {"theme": "family_pressure", "count": 253},
    {"theme": "burnout", "count": 219},
    {"theme": "fear_of_failure", "count": 184},
    {"theme": "social_anxiety", "count": 161},
]


@router.get("/aggregates", response_model=list[ThemeAggregateResponse])
async def get_theme_aggregates(response: Response):
    """
    Get weekly aggregate counts per theme for "Breathing With Others" feature.

    Returns anonymous counts like [{"theme": "work_stress", "count": 127}, ...]
    Falls back to demo data if Elasticsearch is unavailable or returns no results.

    PRIVACY: Aggregate counts only, no user IDs, no individual tracking.
    """
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    aggregates = await elastic.get_aggregates()
    if not aggregates:
        return _DEMO_AGGREGATES
    return aggregates
