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
import logging
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

logger = logging.getLogger("echo")
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
            except Exception as exc:
                logger.warning(f"Failed to save MessageTheme for {message_id}: {exc}")
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
        anonymised_text=anonymized_text,
        theme_category=theme_category,
        match_count=search_result["total"],
        similar_thoughts=similar_thoughts,
        search_after=search_result["search_after"],
    )


@router.delete("/{message_id}")
async def delete_thought(
    message_id: str,
    http_request: Request,
    db: AsyncSession = Depends(get_async_db),
):
    """
    Delete a thought from Elasticsearch and remove account linkage.

    Requires authentication. The client holds the message_id in localStorage
    (only the submitting user knows their own message_ids).

    PRIVACY: Removes the anonymised thought from Elastic and the
    account → message_id mapping from the database.
    """
    from sqlalchemy import delete as sa_delete

    authorization = http_request.headers.get("Authorization", "")
    token = authorization[len("Bearer "):] if authorization.startswith("Bearer ") else ""
    logger.info(f"DELETE /thoughts/{message_id} — token length: {len(token)}, repr tail: {repr(token[-20:]) if token else 'EMPTY'}")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    account_id = auth_service.decode_access_token(token)
    logger.info(f"DELETE /thoughts/{message_id} — decoded account_id: {account_id}")
    if not account_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    # Delete from Elasticsearch
    deleted = await elastic.delete_thought(message_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thought not found.")

    # Clean up account → message linkage if it exists
    try:
        await db.execute(
            sa_delete(MessageTheme).where(
                MessageTheme.account_id == account_id,
                MessageTheme.message_id == message_id,
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()

    return {"deleted": True}


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


_DEMO_GRAPH_NODES = [
    {"message_id": "g1", "humanised_text": "There's this constant feeling that I'm falling behind while everyone around me seems to be moving forward effortlessly.", "theme_category": "comparison", "timestamp_week": "2026-W11", "has_resolution": True},
    {"message_id": "g2", "humanised_text": "I feel invisible at work. I contribute ideas and effort but it's like nobody notices.", "theme_category": "professional_worth", "timestamp_week": "2026-W11", "has_resolution": False},
    {"message_id": "g3", "humanised_text": "Sometimes I lie awake replaying every awkward thing I've ever said in a conversation.", "theme_category": "self_worth", "timestamp_week": "2026-W11", "has_resolution": True},
    {"message_id": "g4", "humanised_text": "I moved to a new city and the loneliness is heavier than I expected. I smile through the day and fall apart at night.", "theme_category": "relationship_loss", "timestamp_week": "2026-W10", "has_resolution": False},
    {"message_id": "g5", "humanised_text": "My family expects me to follow a path I never chose. Every conversation turns into pressure.", "theme_category": "family_pressure", "timestamp_week": "2026-W10", "has_resolution": True},
    {"message_id": "g6", "humanised_text": "I keep starting things with energy and then abandoning them halfway through.", "theme_category": "self_worth", "timestamp_week": "2026-W10", "has_resolution": False},
    {"message_id": "g7", "humanised_text": "There's a person in my life who makes me feel small in ways that are hard to explain.", "theme_category": "relationship_loss", "timestamp_week": "2026-W09", "has_resolution": True},
    {"message_id": "g8", "humanised_text": "I graduated months ago and still don't know what I'm doing with my life.", "theme_category": "professional_worth", "timestamp_week": "2026-W09", "has_resolution": False},
    {"message_id": "g9", "humanised_text": "I catch myself performing happiness around people because being honest sounds exhausting.", "theme_category": "self_worth", "timestamp_week": "2026-W09", "has_resolution": False},
    {"message_id": "g10", "humanised_text": "I helped someone through the hardest time of their life and when I needed the same they weren't there.", "theme_category": "relationship_loss", "timestamp_week": "2026-W08", "has_resolution": True},
    {"message_id": "g11", "humanised_text": "I look at old photos of myself and feel sadness for how harshly I judged that person.", "theme_category": "self_worth", "timestamp_week": "2026-W08", "has_resolution": False},
    {"message_id": "g12", "humanised_text": "I've been told I'm too sensitive my whole life and I've started to believe it.", "theme_category": "self_worth", "timestamp_week": "2026-W08", "has_resolution": True},
    {"message_id": "g13", "humanised_text": "The pressure to always be productive makes me feel guilty for resting.", "theme_category": "burnout", "timestamp_week": "2026-W11", "has_resolution": False},
    {"message_id": "g14", "humanised_text": "I can't stop comparing my life to what I see on social media even though I know it's curated.", "theme_category": "comparison", "timestamp_week": "2026-W10", "has_resolution": False},
    {"message_id": "g15", "humanised_text": "I feel like I'm just going through the motions each day without any real purpose.", "theme_category": "burnout", "timestamp_week": "2026-W09", "has_resolution": True},
    {"message_id": "g16", "humanised_text": "Nobody asks how I'm really doing. They just accept the version of me that smiles.", "theme_category": "loneliness", "timestamp_week": "2026-W11", "has_resolution": False},
    {"message_id": "g17", "humanised_text": "I keep pushing people away because I'm afraid they'll see who I actually am.", "theme_category": "loneliness", "timestamp_week": "2026-W10", "has_resolution": False},
    {"message_id": "g18", "humanised_text": "The gap between who I am and who I want to be feels insurmountable some days.", "theme_category": "self_worth", "timestamp_week": "2026-W11", "has_resolution": False},
    {"message_id": "g19", "humanised_text": "I worry that I peaked in college and everything since has been a slow decline.", "theme_category": "fear_of_failure", "timestamp_week": "2026-W10", "has_resolution": False},
    {"message_id": "g20", "humanised_text": "Every mistake I make at work feels like proof that I don't belong there.", "theme_category": "professional_worth", "timestamp_week": "2026-W11", "has_resolution": True},
]

_DEMO_GRAPH_EDGES = [
    {"source": "g1", "target": "g14", "similarity": 0.89},
    {"source": "g1", "target": "g19", "similarity": 0.72},
    {"source": "g2", "target": "g8", "similarity": 0.85},
    {"source": "g2", "target": "g20", "similarity": 0.82},
    {"source": "g3", "target": "g9", "similarity": 0.78},
    {"source": "g3", "target": "g11", "similarity": 0.76},
    {"source": "g3", "target": "g12", "similarity": 0.71},
    {"source": "g4", "target": "g16", "similarity": 0.80},
    {"source": "g4", "target": "g17", "similarity": 0.74},
    {"source": "g5", "target": "g7", "similarity": 0.65},
    {"source": "g6", "target": "g18", "similarity": 0.77},
    {"source": "g6", "target": "g15", "similarity": 0.68},
    {"source": "g8", "target": "g19", "similarity": 0.79},
    {"source": "g8", "target": "g20", "similarity": 0.73},
    {"source": "g9", "target": "g16", "similarity": 0.83},
    {"source": "g9", "target": "g18", "similarity": 0.70},
    {"source": "g10", "target": "g4", "similarity": 0.67},
    {"source": "g11", "target": "g12", "similarity": 0.81},
    {"source": "g13", "target": "g15", "similarity": 0.86},
    {"source": "g13", "target": "g6", "similarity": 0.63},
    {"source": "g16", "target": "g17", "similarity": 0.88},
    {"source": "g18", "target": "g11", "similarity": 0.72},
    {"source": "g19", "target": "g20", "similarity": 0.66},
]


@router.get("/graph")
async def get_thought_graph(response: Response):
    """
    Get graph data for the thought constellation visualization.

    Returns nodes (anonymized thoughts with timestamps) and edges
    (AI-assessed semantic similarity via embedding vectors).

    PRIVACY: Returns only anonymized/humanized thoughts. No user IDs.
    The frontend overlays the user's own nodes using localStorage message_ids.
    """
    response.headers["Cache-Control"] = "no-cache"
    graph = await elastic.get_graph_data(
        weeks=4, max_nodes=1000, similarity_threshold=0.62
    )
    if not graph["nodes"]:
        response.headers["X-Echo-Demo"] = "true"
        return {"nodes": _DEMO_GRAPH_NODES, "edges": _DEMO_GRAPH_EDGES}
    return graph


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


_DEMO_AGGREGATES_MONTHLY: list[dict] = [
    {"theme": "work_stress", "count": 2847, "resolution_count": 586, "resolution_rate": 21},
    {"theme": "anxiety", "count": 2134, "resolution_count": 420, "resolution_rate": 20},
    {"theme": "loneliness", "count": 1721, "resolution_count": 399, "resolution_rate": 23},
    {"theme": "relationship_conflict", "count": 1678, "resolution_count": 401, "resolution_rate": 24},
    {"theme": "self_worth", "count": 1592, "resolution_count": 394, "resolution_rate": 25},
    {"theme": "grief", "count": 987, "resolution_count": 149, "resolution_rate": 15},
    {"theme": "family_pressure", "count": 853, "resolution_count": 156, "resolution_rate": 18},
    {"theme": "burnout", "count": 819, "resolution_count": 139, "resolution_rate": 17},
    {"theme": "fear_of_failure", "count": 684, "resolution_count": 135, "resolution_rate": 20},
    {"theme": "social_anxiety", "count": 561, "resolution_count": 137, "resolution_rate": 24},
]


@router.get("/aggregates/monthly", response_model=list[ThemeAggregateResponse])
async def get_theme_aggregates_monthly(response: Response):
    """
    Get aggregate counts per theme across the last 4 weeks.

    Used for "Community trends" — shows which themes are most shared.
    Falls back to demo data if Elasticsearch is unavailable or returns no results.

    PRIVACY: Aggregate counts only, no user IDs, no individual tracking.
    """
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=3600"
    aggregates = await elastic.get_aggregates_monthly()
    if not aggregates:
        response.headers["X-Echo-Demo"] = "true"
        return _DEMO_AGGREGATES_MONTHLY
    return aggregates
