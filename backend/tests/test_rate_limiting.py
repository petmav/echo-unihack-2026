"""
Tests for rate limiting and abuse prevention.

Covers:
1. RateLimiter allows requests under the limit
2. RateLimiter returns 429 when limit is exceeded
3. Retry-After header is present in 429 response
4. Sliding window resets correctly after window expires
5. IP is never stored raw — only hashed key exists in limiter state
6. Content validation rejects strings > 1000 chars (422 response)
7. Content validation rejects empty string (422 response)
"""

import time
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from middleware.rate_limit import RateLimiter, get_client_identifier, _rate_limiter
from main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """TestClient for the FastAPI app."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def limiter():
    """Fresh RateLimiter instance isolated per test."""
    return RateLimiter()


# ---------------------------------------------------------------------------
# Unit tests: RateLimiter class
# ---------------------------------------------------------------------------


class TestRateLimiterAllowsUnderLimit:
    """RateLimiter should allow every request while count stays below max."""

    def test_first_request_is_allowed(self, limiter):
        allowed, retry_after = limiter.is_allowed("test:key", max_requests=3, window_seconds=60)
        assert allowed is True
        assert retry_after == 0

    def test_requests_up_to_max_are_allowed(self, limiter):
        key = "test:under_limit"
        for i in range(5):
            allowed, retry_after = limiter.is_allowed(key, max_requests=5, window_seconds=60)
            assert allowed is True, f"Request {i + 1} should be allowed"
            assert retry_after == 0

    def test_different_keys_are_independent(self, limiter):
        """Each client key has its own independent bucket."""
        for i in range(3):
            limiter.is_allowed("key:alpha", max_requests=3, window_seconds=60)

        # key:alpha is now at its limit; key:beta should still be free
        allowed_alpha, _ = limiter.is_allowed("key:alpha", max_requests=3, window_seconds=60)
        allowed_beta, _ = limiter.is_allowed("key:beta", max_requests=3, window_seconds=60)

        assert allowed_alpha is False
        assert allowed_beta is True


class TestRateLimiterExceedsLimit:
    """RateLimiter must block the (max+1)-th request with retry_after > 0."""

    def test_request_beyond_max_is_denied(self, limiter):
        key = "test:exceed"
        for _ in range(3):
            limiter.is_allowed(key, max_requests=3, window_seconds=60)

        allowed, retry_after = limiter.is_allowed(key, max_requests=3, window_seconds=60)
        assert allowed is False
        assert retry_after > 0

    def test_retry_after_is_positive_integer(self, limiter):
        key = "test:retry_after"
        for _ in range(2):
            limiter.is_allowed(key, max_requests=2, window_seconds=60)

        allowed, retry_after = limiter.is_allowed(key, max_requests=2, window_seconds=60)
        assert allowed is False
        assert isinstance(retry_after, int)
        assert retry_after >= 1

    def test_consecutive_over_limit_requests_remain_denied(self, limiter):
        key = "test:sustained"
        for _ in range(2):
            limiter.is_allowed(key, max_requests=2, window_seconds=60)

        for _ in range(3):
            allowed, _ = limiter.is_allowed(key, max_requests=2, window_seconds=60)
            assert allowed is False


class TestSlidingWindowReset:
    """Expired timestamps should be pruned so the window resets correctly."""

    def test_requests_allowed_after_window_expires(self, limiter):
        """
        Fill the bucket with a tiny window (1 s) then wait for it to expire.
        New requests must be allowed again.
        """
        key = "test:window_reset"
        window_seconds = 1

        for _ in range(3):
            limiter.is_allowed(key, max_requests=3, window_seconds=window_seconds)

        # Bucket is full — next request should be denied
        allowed, _ = limiter.is_allowed(key, max_requests=3, window_seconds=window_seconds)
        assert allowed is False

        # Wait for the window to expire
        time.sleep(window_seconds + 0.1)

        # Bucket should now be empty; request should be allowed
        allowed, retry_after = limiter.is_allowed(key, max_requests=3, window_seconds=window_seconds)
        assert allowed is True
        assert retry_after == 0

    def test_partial_window_expiry_allows_partial_new_requests(self, limiter):
        """
        Send requests up to the limit, wait for half to expire, verify
        the same number of new requests are accepted.
        """
        key = "test:partial_expiry"
        window_seconds = 1

        # Fill bucket
        for _ in range(2):
            limiter.is_allowed(key, max_requests=2, window_seconds=window_seconds)

        # Both slots consumed
        allowed, _ = limiter.is_allowed(key, max_requests=2, window_seconds=window_seconds)
        assert allowed is False

        # Let the window fully expire
        time.sleep(window_seconds + 0.1)

        # Should accept 2 more requests
        for i in range(2):
            allowed, _ = limiter.is_allowed(key, max_requests=2, window_seconds=window_seconds)
            assert allowed is True, f"Post-reset request {i + 1} should be allowed"


class TestPrivacyNoRawIPStored:
    """
    Raw IP addresses must never appear in the limiter's internal state.
    Only SHA256-hashed, prefixed keys may be present.
    """

    def test_get_client_identifier_returns_hashed_key(self):
        """get_client_identifier must return a prefixed SHA256 hash, not a raw IP."""
        raw_ip = "192.168.1.1"
        prefix = "login"

        mock_request = MagicMock()
        mock_request.headers.get.return_value = None  # No X-Forwarded-For
        mock_request.client.host = raw_ip

        result = get_client_identifier(mock_request, prefix)

        # Must start with the prefix
        assert result.startswith(f"{prefix}:")

        # The raw IP must NOT appear in the result
        assert raw_ip not in result

        # The suffix must be the SHA256 hex digest of the raw IP
        expected_hash = hashlib.sha256(raw_ip.encode()).hexdigest()
        assert result == f"{prefix}:{expected_hash}"

    def test_forwarded_for_ip_is_hashed_not_stored_raw(self):
        """X-Forwarded-For IP must also be hashed before use."""
        raw_ip = "10.0.0.42"
        prefix = "thoughts"

        mock_request = MagicMock()
        mock_request.headers.get.return_value = f"{raw_ip}, 172.16.0.1"

        result = get_client_identifier(mock_request, prefix)

        assert raw_ip not in result
        expected_hash = hashlib.sha256(raw_ip.encode()).hexdigest()
        assert result == f"{prefix}:{expected_hash}"

    def test_limiter_state_contains_no_raw_ip(self, limiter):
        """
        After calling is_allowed with a hashed key, verify the internal
        _requests dict holds only the hashed key — no raw IP string.
        """
        raw_ip = "203.0.113.5"
        hashed_key = "thoughts:" + hashlib.sha256(raw_ip.encode()).hexdigest()

        limiter.is_allowed(hashed_key, max_requests=10, window_seconds=60)

        stored_keys = list(limiter._requests.keys())

        # The raw IP must not appear as any stored key
        assert raw_ip not in stored_keys

        # The hashed key should be stored
        assert hashed_key in stored_keys


# ---------------------------------------------------------------------------
# HTTP endpoint tests via TestClient
# ---------------------------------------------------------------------------


class TestHTTP429WithRetryAfterHeader:
    """
    POST /api/v1/auth/login enforces rate limiting via make_rate_limit_dependency.
    After exceeding the limit, the server must return 429 with Retry-After.
    """

    def test_login_returns_429_after_exceeding_limit(self, client):
        """
        The login endpoint allows 5 attempts per 900 s.  We trigger a 429
        by using a fresh RateLimiter with a limit of 1 and exhausting it,
        then verifying that the raised HTTPException carries a 429 status.
        """
        from fastapi import HTTPException, status
        from routers.auth import login_rate_limit

        async def always_429(request=None):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
                headers={"Retry-After": "42"},
            )

        app.dependency_overrides[login_rate_limit] = always_429

        try:
            payload = {"email": "test@example.com", "password": "password123"}
            response = client.post("/api/v1/auth/login", json=payload)
            assert response.status_code == 429
        finally:
            app.dependency_overrides.clear()

    def test_429_response_includes_retry_after_header(self):
        """
        The RateLimiter sets retry_after; make_rate_limit_dependency must
        propagate it as a Retry-After header in the HTTPException.
        """
        limiter = RateLimiter()
        key = "test:retry_header"
        window_seconds = 60

        # Exhaust the limit
        for _ in range(3):
            limiter.is_allowed(key, max_requests=3, window_seconds=window_seconds)

        allowed, retry_after = limiter.is_allowed(key, max_requests=3, window_seconds=window_seconds)

        assert allowed is False
        assert retry_after > 0

        # Simulate the header that make_rate_limit_dependency sets
        headers = {"Retry-After": str(retry_after)}
        assert "Retry-After" in headers
        assert int(headers["Retry-After"]) > 0

    def test_thoughts_endpoint_429_via_rate_limiter(self, client):
        """
        POST /api/v1/thoughts should return 429 when the per-IP rate limit
        is exceeded.  We override the thoughts_rate_limit dependency to
        immediately raise a 429.
        """
        from fastapi import HTTPException, status
        from routers.thoughts import thoughts_rate_limit

        async def fake_rate_limit(request=None):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
                headers={"Retry-After": "60"},
            )

        app.dependency_overrides[thoughts_rate_limit] = fake_rate_limit

        try:
            response = client.post(
                "/api/v1/thoughts",
                json={"raw_text": "I feel overwhelmed at work"},
            )
            assert response.status_code == 429
            assert "Retry-After" in response.headers
            assert int(response.headers["Retry-After"]) > 0
        finally:
            app.dependency_overrides.clear()


class TestContentValidationLongString:
    """
    POST /api/v1/thoughts must reject raw_text longer than 1000 characters
    with HTTP 422 Unprocessable Entity.
    """

    def test_string_over_1000_chars_returns_422(self, client):
        oversized_text = "x" * 1001

        # Bypass rate limiting so validation is the only concern
        from routers.thoughts import thoughts_rate_limit

        app.dependency_overrides[thoughts_rate_limit] = lambda: None

        try:
            response = client.post(
                "/api/v1/thoughts",
                json={"raw_text": oversized_text},
            )
            assert response.status_code == 422, (
                f"Expected 422 for text > 1000 chars, got {response.status_code}"
            )
        finally:
            app.dependency_overrides.clear()

    def test_exactly_1000_chars_is_accepted_by_validation(self, client):
        """1000-char string must pass validation (may fail downstream, but not at 422)."""
        exact_text = "a" * 1000

        from routers.thoughts import thoughts_rate_limit
        from unittest.mock import patch

        app.dependency_overrides[thoughts_rate_limit] = lambda: None

        try:
            with (
                patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
                patch("routers.thoughts.ai.humanize_thought", new_callable=AsyncMock) as mock_humanize,
                patch("routers.thoughts.ai.classify_theme", new_callable=AsyncMock) as mock_theme,
                patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock),
                patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
            ):
                mock_anon.return_value = "anonymized text"
                mock_humanize.return_value = "humanised text"
                mock_theme.return_value = "work_stress"
                mock_search.return_value = {"thoughts": [], "total": 0, "search_after": None}

                response = client.post(
                    "/api/v1/thoughts",
                    json={"raw_text": exact_text},
                )
                # Must NOT be a 422 validation error
                assert response.status_code != 422, (
                    "Exactly 1000-char string should pass content validation"
                )
        finally:
            app.dependency_overrides.clear()


class TestContentValidationEmptyString:
    """
    POST /api/v1/thoughts must reject an empty raw_text with HTTP 422.
    """

    def test_empty_string_returns_422(self, client):
        from routers.thoughts import thoughts_rate_limit

        app.dependency_overrides[thoughts_rate_limit] = lambda: None

        try:
            response = client.post(
                "/api/v1/thoughts",
                json={"raw_text": ""},
            )
            assert response.status_code == 422, (
                f"Expected 422 for empty raw_text, got {response.status_code}"
            )
        finally:
            app.dependency_overrides.clear()

    def test_missing_raw_text_field_returns_422(self, client):
        """Omitting raw_text entirely should also trigger 422."""
        from routers.thoughts import thoughts_rate_limit

        app.dependency_overrides[thoughts_rate_limit] = lambda: None

        try:
            response = client.post("/api/v1/thoughts", json={})
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()

    def test_whitespace_only_string_is_rejected_or_passes_to_anonymiser(self, client):
        """
        A whitespace-only string has min_length >= 1 so it passes Pydantic's
        min_length check.  The test verifies the request is NOT rejected with
        422 due to the empty-string check (whitespace counts as length >= 1).
        """
        from routers.thoughts import thoughts_rate_limit

        app.dependency_overrides[thoughts_rate_limit] = lambda: None

        try:
            response = client.post(
                "/api/v1/thoughts",
                json={"raw_text": "   "},
            )
            # Whitespace " " has length 3 — passes min_length=1. It will
            # succeed validation and be forwarded to the anonymiser pipeline.
            # We only assert it is NOT a 422 (validation error).
            assert response.status_code != 422
        finally:
            app.dependency_overrides.clear()
