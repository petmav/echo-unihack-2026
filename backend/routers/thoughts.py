"""
Thoughts router: POST /thoughts, GET /thoughts/similar, GET /thoughts/aggregates

PRIVACY CRITICAL:
- Raw thought text in POST body is anonymized IMMEDIATELY
- NEVER logged, NEVER persisted to disk
- Only anonymized + humanized output reaches Elasticsearch
"""

import asyncio
import hashlib
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import config
from database import MessageTheme, get_async_db
from middleware.rate_limit import _rate_limiter, get_client_identifier
from models.thought import (
    PaginatedThoughts,
    ThemeAggregateResponse,
    ThemeCountResponse,
    ThoughtResponse,
    ThoughtSubmitRequest,
    ThoughtSubmitResult,
)
from services import ai, elastic, embeddings
from services import anonymiser as anonymiser_service
from services import auth as auth_service
from services.ai import ClaudeAPIError, ClaudeRateLimitError

router = APIRouter(prefix="/thoughts", tags=["thoughts"])

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


@router.post("", response_model=ThoughtSubmitResult)
async def submit_thought(
    request: ThoughtSubmitRequest,
    http_request: Request,
    _: None = Depends(thoughts_rate_limit),
    db: AsyncSession = Depends(get_async_db),
):
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
    except anonymiser_service.OllamaConnectionError as err:
        raise HTTPException(
            status_code=503,
            detail="Anonymization service unavailable. Please try again later.",
        ) from err
    except anonymiser_service.OllamaTimeoutError as err:
        raise HTTPException(
            status_code=503,
            detail="Anonymization service timed out. Please try again later.",
        ) from err
    except anonymiser_service.OllamaResponseError as err:
        raise HTTPException(
            status_code=502,
            detail="Anonymization service returned an invalid response.",
        ) from err

    # Step 2+3: Humanize AND classify in a single API call (saves one round-trip)
    try:
        humanised_text, theme_category = await ai.humanize_and_classify(anonymized_text)
    except ClaudeRateLimitError as err:
        raise HTTPException(
            status_code=429,
            detail="Service is temporarily busy. Please try again in a moment.",
        ) from err
    except (ClaudeAPIError, Exception) as err:
        raise HTTPException(
            status_code=502,
            detail="Humanization service failed. Please try again later.",
        ) from err

    # Step 4: Generate unique message ID and embed humanised text
    message_id = str(uuid.uuid4())
    sentiment_vector = await embeddings.embed(humanised_text)

    # Step 5a: Record account → message_id → theme linkage if authenticated
    # (non-fatal; used only for targeted cleanup on account deletion)
    authorization = http_request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        account_id = auth_service.decode_access_token(authorization[len("Bearer "):])
        if account_id:
            try:
                db.add(MessageTheme(
                    id=str(uuid.uuid4()),
                    account_id=account_id,
                    message_id=message_id,
                    theme_category=theme_category,
                ))
                await db.commit()
            except Exception:
                await db.rollback()

    # Step 5b+6: Index and search in parallel — both need the same vector
    index_coro = elastic.index_thought(
        message_id=message_id,
        humanised_text=humanised_text,
        theme_category=theme_category,
        sentiment_vector=sentiment_vector,
    )
    search_coro = elastic.search_similar_thoughts(
        theme_category=theme_category,
        sentiment_vector=sentiment_vector,
        limit=20,
    )
    index_outcome, search_outcome = await asyncio.gather(
        index_coro, search_coro, return_exceptions=True
    )

    # Indexing failure is non-fatal — search result is what matters
    search_result = (
        search_outcome
        if not isinstance(search_outcome, Exception)
        else {"thoughts": [], "total": 0, "search_after": None}
    )

    similar_thoughts = [
        ThoughtResponse(
            message_id=t["message_id"],
            humanised_text=t["humanised_text"],
            theme_category=t["theme_category"],
            has_resolution=t.get("has_resolution", False),
            resolution_text=t.get("resolution_text"),
            similarity_score=t.get("similarity_score"),
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


@router.get("/count", response_model=ThemeCountResponse)
async def get_thought_count(
    theme: str = Query(..., description="Theme category to count thoughts for"),
    response: Response = None,
):
    """
    Get live all-time anonymous stats for a specific theme.

    Used for real-time "X people feel the same" updates on the results screen,
    plus the per-theme "what helped" aggregate banner. Polls every ~30s from
    the client while the results screen is open.

    PRIVACY: Returns aggregate counts only. No user IDs, no individual tracking.
    """
    response.headers["Cache-Control"] = "no-store"
    stats = await elastic.get_total_theme_resolution_stats(theme)
    if stats["count"] == 0:
        response.headers["X-Echo-Demo"] = "true"
        demo_stats = next(
            (aggregate for aggregate in _DEMO_AGGREGATES if aggregate["theme"] == theme),
            None,
        )
        if demo_stats is None:
            demo_stats = {
                "theme": theme,
                "count": 847,
                "resolution_count": 186,
                "resolution_rate": 22,
            }
        return {
            "theme": theme,
            "count": demo_stats["count"],
            "resolution_count": demo_stats["resolution_count"],
            "resolution_rate": demo_stats["resolution_rate"],
        }
    return {
        "theme": theme,
        "count": stats["count"],
        "resolution_count": stats["resolution_count"],
        "resolution_rate": stats["resolution_rate"],
    }


@router.get("/similar", response_model=PaginatedThoughts)
async def get_similar_thoughts(
    message_id: str = Query(..., description="Message ID to find similar thoughts for"),
    size: int = Query(20, ge=1, le=100, description="Number of results per page"),
    search_after: str | None = Query(
        None, description="Elasticsearch search_after cursor (JSON array)"
    ),
):
    """
    Get paginated similar thoughts for infinite scroll.

    Uses Elasticsearch search_after for efficient deep pagination.

    PRIVACY: Returns only anonymized/humanized thoughts with no user linkage.
    """
    parsed_cursor: list | None = None
    if search_after is not None:
        try:
            parsed_cursor = json.loads(search_after)
            if not isinstance(parsed_cursor, list):
                raise ValueError("search_after must be a JSON array")
        except (json.JSONDecodeError, ValueError) as err:
            raise HTTPException(
                status_code=422,
                detail="Invalid search_after cursor: must be a JSON array string.",
            ) from err

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
            similarity_score=t.get("similarity_score"),
        )
        for t in search_result["thoughts"]
    ]

    return PaginatedThoughts(
        thoughts=thoughts,
        search_after=search_result["search_after"],
        total=search_result["total"],
    )


@router.get("/seed-for-theme")
async def get_seed_for_theme(
    theme: str = Query(..., description="Theme category key (e.g. work_stress, anxiety)"),
):
    """
    Return one message_id from this theme for use with GET /thoughts/similar.
    Enables topic exploration: use this seed with /similar for semantic matching.
    Returns 404 if the theme has no thoughts.
    """
    message_id = await elastic.get_seed_message_id_for_theme(theme)
    if message_id is None:
        raise HTTPException(status_code=404, detail="No thoughts found for this theme.")
    return {"message_id": message_id}


@router.get("/by-theme", response_model=PaginatedThoughts)
async def get_thoughts_by_theme(
    theme: str = Query(..., description="Theme category key (e.g. work_stress, anxiety)"),
    size: int = Query(20, ge=1, le=100, description="Number of results per page"),
    search_after: str | None = Query(
        None, description="Elasticsearch search_after cursor (JSON array)"
    ),
):
    """
    Get paginated thoughts for a theme (topic-bubble exploration).
    No user context — anonymous browse by theme only.

    PRIVACY: Returns only anonymized/humanized thoughts with no user linkage.
    """
    parsed_cursor: list | None = None
    if search_after is not None:
        try:
            parsed_cursor = json.loads(search_after)
            if not isinstance(parsed_cursor, list):
                raise ValueError("search_after must be a JSON array")
        except (json.JSONDecodeError, ValueError) as err:
            raise HTTPException(
                status_code=422,
                detail="Invalid search_after cursor: must be a JSON array string.",
            ) from err

    search_result = await elastic.search_thoughts_by_theme(
        theme_category=theme,
        limit=size,
        search_after=parsed_cursor,
    )

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
    {"theme": "work_stress", "count": 847, "resolution_count": 186, "resolution_rate": 22},
    {"theme": "anxiety", "count": 634, "resolution_count": 120, "resolution_rate": 19},
    {"theme": "loneliness", "count": 521, "resolution_count": 99, "resolution_rate": 19},
    {"theme": "relationship_conflict", "count": 478, "resolution_count": 101, "resolution_rate": 21},
    {"theme": "self_worth", "count": 392, "resolution_count": 94, "resolution_rate": 24},
    {"theme": "grief", "count": 287, "resolution_count": 49, "resolution_rate": 17},
    {"theme": "family_pressure", "count": 253, "resolution_count": 56, "resolution_rate": 22},
    {"theme": "burnout", "count": 219, "resolution_count": 39, "resolution_rate": 18},
    {"theme": "fear_of_failure", "count": 184, "resolution_count": 35, "resolution_rate": 19},
    {"theme": "social_anxiety", "count": 161, "resolution_count": 37, "resolution_rate": 23},
]


@router.get("/aggregates", response_model=list[ThemeAggregateResponse])
async def get_theme_aggregates(response: Response):
    """
    Get weekly aggregate counts per theme for "Breathing With Others" feature.

    Returns anonymous aggregate items like
    [{"theme": "work_stress", "count": 127, "resolution_count": 31,
      "resolution_rate": 24}, ...].
    Falls back to demo data if Elasticsearch is unavailable or returns no results.

    PRIVACY: Aggregate counts only, no user IDs, no individual tracking.
    """
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    aggregates = await elastic.get_aggregates()
    if not aggregates:
        response.headers["X-Echo-Demo"] = "true"
        return _DEMO_AGGREGATES
    return aggregates
