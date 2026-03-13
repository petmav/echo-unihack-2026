"""
Rate limiting middleware for Echo backend.

Implements a sliding window rate limiter using in-memory storage (collections.deque).
Provides privacy-safe client identification via SHA256 hashing of IP addresses.

PRIVACY NOTE:
- Raw IP addresses are NEVER stored — only SHA256 hashes are kept in memory
- Hashes are scoped with a key_prefix and not persisted to disk or logs
- Rate limit keys are ephemeral and cleared as windows slide

Usage:
    from middleware.rate_limit import make_rate_limit_dependency
    from config import config

    thought_rate_limit = make_rate_limit_dependency(
        max_requests=config.RATE_LIMIT_THOUGHTS_PER_HOUR,
        window_seconds=3600,
        key_prefix="thoughts",
    )

    @router.post("/thoughts", dependencies=[Depends(thought_rate_limit)])
    async def submit_thought(...):
        ...
"""

import hashlib
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Depends, HTTPException, Request, status


class RateLimiter:
    """
    In-memory sliding window rate limiter.

    Uses collections.deque to efficiently track request timestamps within
    a rolling time window. Old timestamps are pruned as the window advances.

    Privacy:
        Client identifiers stored in this structure are SHA256 hashes,
        never raw IP addresses.
    """

    def __init__(self) -> None:
        # Maps hashed_client_key -> deque of request timestamps
        self._requests: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, client_key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """
        Check whether a request is allowed under the rate limit.

        Args:
            client_key: Hashed, prefixed client identifier.
            max_requests: Maximum number of requests permitted in the window.
            window_seconds: Duration of the sliding window in seconds.

        Returns:
            Tuple of (allowed: bool, retry_after_seconds: int).
            retry_after_seconds is 0 when allowed, otherwise the number of
            seconds until the oldest request in the window expires.
        """
        now = time.monotonic()
        cutoff = now - window_seconds

        bucket = self._requests[client_key]

        # Prune timestamps that have fallen outside the window
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) < max_requests:
            bucket.append(now)
            return True, 0

        # Calculate how long until the earliest request leaves the window
        oldest = bucket[0]
        retry_after = int(oldest - cutoff) + 1
        return False, retry_after

    def clear(self, client_key: str) -> None:
        """Remove all recorded requests for a given client key."""
        self._requests.pop(client_key, None)


# Module-level singleton shared across all dependency instances
_rate_limiter = RateLimiter()


def get_client_identifier(request: Request, key_prefix: str) -> str:
    """
    Derive a privacy-safe, prefixed client identifier from the request.

    Extracts the client IP from X-Forwarded-For (trusted proxy header) or
    falls back to the direct connection address. The raw IP is immediately
    hashed with SHA256 and NEVER stored or logged.

    Args:
        request: The incoming FastAPI request.
        key_prefix: A short string scoping the identifier to a specific
                    rate-limit context (e.g. "thoughts", "login").

    Returns:
        A string in the form "<key_prefix>:<sha256_hex>" suitable for use
        as a rate-limit bucket key.
    """
    # Prefer forwarded IP if behind a reverse proxy; fall back to direct peer
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first (leftmost) address — the original client
        raw_ip = forwarded_for.split(",")[0].strip()
    else:
        raw_ip = request.client.host if request.client else "unknown"

    # SHA256 the raw IP immediately — never retain it
    ip_hash = hashlib.sha256(raw_ip.encode()).hexdigest()
    return f"{key_prefix}:{ip_hash}"


def make_rate_limit_dependency(
    max_requests: int,
    window_seconds: int,
    key_prefix: str,
) -> Callable:
    """
    Factory that returns a FastAPI Depends()-compatible async dependency
    enforcing a sliding window rate limit.

    Args:
        max_requests: Maximum number of requests allowed within the window.
        window_seconds: Length of the sliding window in seconds.
        key_prefix: Short label scoping this limiter (e.g. "thoughts", "login").

    Returns:
        An async callable suitable for use with FastAPI's Depends().

    Raises:
        HTTPException 429: When the client exceeds the rate limit.
                           Includes a Retry-After header indicating how many
                           seconds the client should wait before retrying.

    Example:
        thought_rate_limit = make_rate_limit_dependency(
            max_requests=10, window_seconds=3600, key_prefix="thoughts"
        )

        @router.post("/thoughts", dependencies=[Depends(thought_rate_limit)])
        async def submit_thought(...):
            ...
    """

    async def _rate_limit_dependency(request: Request) -> None:
        client_key = get_client_identifier(request, key_prefix)
        allowed, retry_after = _rate_limiter.is_allowed(
            client_key=client_key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
                headers={"Retry-After": str(retry_after)},
            )

    return _rate_limit_dependency
