"""
Resolution router: POST /resolution, GET /resolution/{message_id}

Handles "what helped" advice flow when users resolve issues.

PRIVACY CRITICAL:
- Resolution text goes through Anonymizer SLM 0.6B (same as thoughts)
- Stored verbatim after anonymization (NEVER paraphrased by AI)
- Misconstrued mental health advice is a real harm — we show verbatim only
"""

from fastapi import APIRouter, HTTPException

from models.resolution import ResolutionSubmit
from services import anonymiser as anonymiser_service
from services import elastic

router = APIRouter(prefix="/resolution", tags=["resolution"])

_RESOLUTION_RATE_LIMIT_MAX = config.RATE_LIMIT_RESOLUTION_PER_HOUR
_RESOLUTION_RATE_LIMIT_WINDOW = 3600  # seconds


async def resolution_rate_limit(request: Request) -> None:
    """
    Account-based rate limit dependency for POST /resolution.

    Identifies the client using their account_id (extracted from the JWT
    Bearer token without requiring authentication) when present, falling
    back to a SHA256-hashed IP address for unauthenticated requests.

    Limit: 5 requests per 3600 seconds.

    Raises:
        HTTPException 429: When the client exceeds the rate limit.
    """
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
        account_id = auth_service.decode_access_token(token)
        if account_id:
            # Hash the account_id for consistency with the privacy model
            account_hash = hashlib.sha256(account_id.encode()).hexdigest()
            client_key = f"resolution:account:{account_hash}"
        else:
            # Token present but invalid/expired — fall back to hashed IP
            client_key = get_client_identifier(request, "resolution")
    else:
        client_key = get_client_identifier(request, "resolution")

    allowed, retry_after = _rate_limiter.is_allowed(
        client_key=client_key,
        max_requests=_RESOLUTION_RATE_LIMIT_MAX,
        window_seconds=_RESOLUTION_RATE_LIMIT_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )


@router.post("", response_model=dict)
async def submit_resolution(submission: ResolutionSubmit, _: None = Depends(resolution_rate_limit)):
    """
    Submit "what helped" advice for a resolved thought.

    Flow:
    1. Receive resolution_text (may contain PII)
    2. Anonymize with SLM 0.6B (strip PII, preserve specificity)
    3. Store verbatim in Elasticsearch linked to message_id
    4. Return confirmation with anonymized text

    PRIVACY: Raw resolution_text is anonymized immediately and never persisted.
    Anonymized version is stored verbatim and shown verbatim (NOT paraphrased).
    """
    # Step 1: Anonymize resolution text — MUST be called first, raw text discarded after
    try:
        anonymized_text = await anonymiser_service.anonymize_text(submission.resolution_text)
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

    # Step 2: Store anonymized resolution text in Elasticsearch
    stored = await elastic.store_resolution(
        message_id=submission.message_id,
        resolution_text=anonymized_text,
    )

    if not stored:
        raise HTTPException(
            status_code=502,
            detail="Failed to store resolution. Please try again later.",
        )

    return {"success": True, "message_id": submission.message_id}


@router.get("/{message_id}", response_model=ResolutionResponse)
async def get_resolution(message_id: str):
    """
    Retrieve "what helped" advice for a specific thought.

    Returns anonymized resolution text verbatim, or 404 if no resolution exists.

    PRIVACY: Returns only anonymized resolution text, no user identifiers.
    """
    resolution = await elastic.get_resolution(message_id)

    if resolution is None:
        raise HTTPException(
            status_code=404,
            detail=f"No resolution found for thought {message_id}.",
        )

    return {
        "message_id": resolution["message_id"],
        "resolution_text": resolution["anonymised_text"],
    }
