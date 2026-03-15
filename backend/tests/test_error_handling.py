"""
Unit tests for backend error handling and input validation.

Tests cover:
- Global exception handler (unhandled exceptions return 500 with generic message)
- Request size limit middleware (413 when Content-Length exceeds 10KB)
- Ollama unavailable → 503 Service Unavailable
- Claude rate limit → 429 Too Many Requests
- Elasticsearch unavailable → graceful fallback (not fatal)
- Privacy invariant: error responses NEVER contain raw thought text

PRIVACY NOTE:
    No raw thought text is logged or stored in any test. All test data used
    in mocked error scenarios is disposable placeholder text.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from services.ai import ClaudeAPIError, ClaudeRateLimitError
from services.anonymiser import (
    OllamaConnectionError,
    OllamaResponseError,
    OllamaTimeoutError,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Synchronous test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def client_no_raise():
    """
    Test client that catches server-side exceptions and returns the HTTP response
    instead of re-raising. Required to test global exception handler behaviour
    for truly unhandled exceptions.
    """
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _thought_payload(text: str = "I feel overwhelmed by everything lately") -> dict:
    """Return a valid POST /api/v1/thoughts request body."""
    return {"text": text}


def _assert_no_raw_text_in_response(response_text: str, raw_input: str) -> None:
    """
    PRIVACY GUARD: Assert that no meaningful token from raw_input appears in response.

    Checks words of length > 4 to avoid false positives from common short words
    that might legitimately appear in error messages.
    """
    response_lower = response_text.lower()
    for word in raw_input.split():
        # Only check meaningful tokens (> 4 chars) to avoid false positives
        if len(word) > 4:
            assert word.lower() not in response_lower, (
                f"PRIVACY VIOLATION: token '{word}' from raw input found in error response"
            )


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

class TestGlobalExceptionHandler:
    """
    Tests for the global catch-all exception handler registered in main.py.

    Verifies that unhandled exceptions return HTTP 500 with a generic message
    and never expose implementation details or raw thought text.

    NOTE: TestClient re-raises server exceptions by default. Tests that need
    to inspect the HTTP 500 response must use the client_no_raise fixture.
    """

    def test_global_handler_returns_500_for_unexpected_exception(self, client_no_raise):
        """
        When an unhandled RuntimeError escapes the router, the global handler
        should catch it and return HTTP 500 with a generic error message.
        """
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Unexpected internal crash"),
        ):
            response = client_no_raise.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Internal server error"

    def test_404_handler_returns_generic_message(self, client):
        """Non-existent endpoint should return 404 with a generic message."""
        response = client.get("/api/v1/nonexistent_endpoint")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        # Generic message — no implementation details
        assert "not found" in data["detail"].lower()

    def test_global_handler_response_does_not_leak_exception_message(self, client_no_raise):
        """
        Exception message must NOT appear in the HTTP response body.

        Prevents leaking internal implementation details (database passwords,
        internal host names, etc.) through the error response.
        """
        secret_exception_message = "DatabasePassword=SuperSecret123"

        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=Exception(secret_exception_message),
        ):
            response = client_no_raise.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 500
        assert secret_exception_message not in response.text


# ---------------------------------------------------------------------------
# Request size limit middleware
# ---------------------------------------------------------------------------

class TestRequestSizeLimits:
    """
    Tests for the RequestSizeLimitMiddleware added in main.py.

    The default limit is 10KB (10,240 bytes). Requests declaring a larger
    Content-Length via the header should be rejected with HTTP 413.
    """

    def test_normal_request_accepted(self, client):
        """
        A thought within the 1000-character Pydantic limit is well within
        the 10KB body size limit. The middleware should pass it through.

        Because we mock the full pipeline, no external services are needed.
        """
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] feels overwhelmed",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                return_value=("Someone feels completely overwhelmed by everything around them.", "overwhelm"),
            ),
            patch(
                "routers.thoughts.embeddings.embed",
                new_callable=AsyncMock,
                return_value=[0.1] * 384,
            ),
            patch(
                "routers.thoughts.elastic.index_thought",
                new_callable=AsyncMock,
            ),
            patch(
                "routers.thoughts.elastic.search_similar_thoughts",
                new_callable=AsyncMock,
                return_value={"thoughts": [], "total": 0, "search_after": None},
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        # Should not be rejected by size middleware
        assert response.status_code != 413

    def test_oversized_request_rejected_via_content_length_header(self, client):
        """
        A request whose Content-Length header declares more than 10KB
        should be rejected with HTTP 413 before reaching the router.
        """
        oversized_body = b'{"raw_text": "' + b"x" * 200 + b'"}'

        response = client.post(
            "/api/v1/thoughts",
            content=oversized_body,
            headers={
                "Content-Type": "application/json",
                # Declare 11KB — exceeds the 10KB limit
                "Content-Length": str(11 * 1024),
            },
        )

        assert response.status_code == 413
        data = response.json()
        assert "detail" in data
        assert "too large" in data["detail"].lower() or "maximum" in data["detail"].lower()

    def test_413_response_does_not_contain_request_body(self, client):
        """
        PRIVACY: The 413 error response must not echo back any part of the
        request body (which could contain raw thought text / PII).
        """
        raw_thought = "My boss David at CIA headquarters undermines me"
        body = f'{{"raw_text": "{raw_thought}"}}'.encode()

        response = client.post(
            "/api/v1/thoughts",
            content=body,
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(11 * 1024),
            },
        )

        assert response.status_code == 413
        _assert_no_raw_text_in_response(response.text, raw_thought)


# ---------------------------------------------------------------------------
# Ollama (anonymiser) unavailable → 503
# ---------------------------------------------------------------------------

class TestOllamaUnavailableHandling:
    """
    Tests for graceful degradation when the Ollama anonymiser is unreachable.

    Ollama failure must result in HTTP 503 (not 500 or a crash) so that the
    frontend can surface a user-friendly retry message. Raw input text must
    never appear in the error response.
    """

    def test_ollama_connection_error_returns_503(self, client):
        """OllamaConnectionError must map to HTTP 503."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Could not connect to Ollama"),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data

    def test_ollama_timeout_error_returns_503(self, client):
        """OllamaTimeoutError must also map to HTTP 503."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaTimeoutError("Ollama request timed out"),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data

    def test_ollama_response_error_returns_502(self, client):
        """OllamaResponseError (bad response) must map to HTTP 502."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaResponseError("Ollama returned an invalid response"),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 502
        data = response.json()
        assert "detail" in data

    def test_ollama_error_message_does_not_contain_raw_text(self, client):
        """
        CRITICAL PRIVACY TEST: Raw input text must NEVER appear in error responses.

        Even when the anonymiser fails before processing the text, the raw thought
        must not be echoed back in the HTTP error response.
        """
        raw_input = "My colleague Sarah at FBI headquarters is impossible to work with"
        sensitive_tokens = ["Sarah", "FBI", "headquarters", "impossible"]

        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Anonymizer service unavailable"),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": raw_input},
            )

        assert response.status_code == 503
        response_lower = response.text.lower()
        for token in sensitive_tokens:
            assert token.lower() not in response_lower, (
                f"PRIVACY VIOLATION: '{token}' found in 503 error response"
            )

    def test_ollama_error_detail_is_user_friendly(self, client):
        """Error detail should reference the service being unavailable."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Cannot connect"),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        data = response.json()
        detail = data["detail"].lower()
        # Should communicate service unavailability
        assert "unavailable" in detail or "service" in detail or "try again" in detail


# ---------------------------------------------------------------------------
# Claude rate limit → 429
# ---------------------------------------------------------------------------

class TestClaudeRateLimitHandling:
    """
    Tests for graceful handling of Claude API rate limit errors.

    When Claude returns HTTP 429 (rate limit exceeded), the backend should
    propagate a 429 to the client rather than a 500 crash.
    """

    def test_claude_rate_limit_on_humanize_returns_429(self, client):
        """
        When humanize_and_classify raises ClaudeRateLimitError, the endpoint must
        return HTTP 429 with a user-friendly message.
        """
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] feels overwhelmed",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeRateLimitError("Rate limit exceeded"),
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 429
        data = response.json()
        assert "detail" in data

    def test_claude_rate_limit_on_classify_returns_429(self, client):
        """
        When humanize_and_classify raises ClaudeRateLimitError, the endpoint must
        also return HTTP 429.
        """
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] feels overwhelmed",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeRateLimitError("Rate limit exceeded"),
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 429

    def test_claude_api_error_returns_502(self, client):
        """Non-rate-limit Claude API errors should return HTTP 502."""
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] feels overwhelmed",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeAPIError("Claude API internal error"),
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 502

    def test_claude_rate_limit_response_does_not_contain_raw_text(self, client):
        """
        PRIVACY: Raw thought text must not appear in the 429 error response.
        """
        raw_input = "My partner Jennifer cheated on me and I cannot cope"
        sensitive_tokens = ["Jennifer", "cheated", "partner"]

        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] betrayed me and I cannot cope",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeRateLimitError("Rate limit exceeded"),
            ),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": raw_input},
            )

        assert response.status_code == 429
        response_lower = response.text.lower()
        for token in sensitive_tokens:
            assert token.lower() not in response_lower, (
                f"PRIVACY VIOLATION: '{token}' found in 429 error response"
            )


# ---------------------------------------------------------------------------
# Elasticsearch unavailable → graceful fallback
# ---------------------------------------------------------------------------

class TestElasticsearchFallback:
    """
    Tests for graceful degradation when Elasticsearch is unavailable.

    Per the architecture: Elasticsearch failure is NON-FATAL. The thought
    submission should still succeed and return a result (with empty similar
    thoughts), rather than returning an error to the user.
    """

    def test_elastic_index_failure_is_non_fatal(self, client):
        """
        If Elasticsearch indexing fails, POST /api/v1/thoughts must still
        return HTTP 200. The thought is processed and the user sees results
        even if indexing fails.
        """
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] feels overwhelmed at [company]",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                return_value=("Someone feels completely overwhelmed by work expectations.", "overwhelm"),
            ),
            patch(
                "routers.thoughts.embeddings.embed",
                new_callable=AsyncMock,
                return_value=[0.1] * 384,
            ),
            patch(
                "routers.thoughts.elastic.index_thought",
                new_callable=AsyncMock,
                side_effect=Exception("Elasticsearch cluster unavailable"),
            ),
            patch(
                "routers.thoughts.elastic.search_similar_thoughts",
                new_callable=AsyncMock,
                side_effect=Exception("Elasticsearch cluster unavailable"),
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        # Must succeed despite Elastic being down
        assert response.status_code == 200
        data = response.json()
        assert "message_id" in data
        assert "theme_category" in data
        assert data["match_count"] == 0
        assert data["similar_thoughts"] == []

    def test_elastic_search_failure_returns_empty_results(self, client):
        """
        If only the search phase fails (indexing succeeded), similar_thoughts
        should be empty rather than crashing.
        """
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] feels overwhelmed",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                return_value=("Someone feels completely overwhelmed by everything.", "overwhelm"),
            ),
            patch(
                "routers.thoughts.embeddings.embed",
                new_callable=AsyncMock,
                return_value=[0.1] * 384,
            ),
            patch(
                "routers.thoughts.elastic.index_thought",
                new_callable=AsyncMock,
            ),
            patch(
                "routers.thoughts.elastic.search_similar_thoughts",
                new_callable=AsyncMock,
                side_effect=ConnectionError("Cannot reach Elasticsearch"),
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_thought_payload())

        assert response.status_code == 200
        data = response.json()
        assert data["similar_thoughts"] == []
        assert data["match_count"] == 0

    def test_elastic_failure_does_not_expose_raw_text(self, client):
        """
        PRIVACY: Even in Elasticsearch fallback scenarios, raw thought text
        must not appear in the response (it should never have been stored).

        Uses raw_input and mock outputs with no overlapping tokens (>4 chars)
        so _assert_no_raw_text_in_response can verify no raw content leaks.
        """
        raw_input = "My uncle Robert at Apple Inc causes me great distress"

        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] makes me feel awful",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                return_value=("Someone in my family makes me feel consistently awful.", "family_tension"),
            ),
            patch(
                "routers.thoughts.embeddings.embed",
                new_callable=AsyncMock,
                return_value=[0.1] * 384,
            ),
            patch(
                "routers.thoughts.elastic.index_thought",
                new_callable=AsyncMock,
                side_effect=Exception("Elasticsearch unavailable"),
            ),
            patch(
                "routers.thoughts.elastic.search_similar_thoughts",
                new_callable=AsyncMock,
                side_effect=Exception("Elasticsearch unavailable"),
            ),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": raw_input},
            )

        assert response.status_code == 200
        # Sensitive tokens from raw input must not appear in response
        _assert_no_raw_text_in_response(response.text, raw_input)


# ---------------------------------------------------------------------------
# Privacy invariant: error responses never contain raw thought text
# ---------------------------------------------------------------------------

class TestPrivacyInvariantErrorResponses:
    """
    Privacy regression tests: verify that error responses never contain
    raw thought text across multiple failure scenarios.

    These tests are the privacy "canary" — if any of these fail, a privacy
    regression has been introduced.
    """

    PII_THOUGHT = "My sister Emma in Sydney works at Atlassian and hates her life"
    PII_TOKENS = ["Emma", "Sydney", "Atlassian", "sister"]

    def _assert_no_pii_in_response(self, response_text: str) -> None:
        """Assert PII tokens from the test thought do not appear in response."""
        response_lower = response_text.lower()
        for token in self.PII_TOKENS:
            assert token.lower() not in response_lower, (
                f"PRIVACY VIOLATION: '{token}' found in error response"
            )

    def test_503_ollama_does_not_leak_pii(self, client):
        """503 from Ollama failure must not leak PII."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Ollama down"),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": self.PII_THOUGHT},
            )

        assert response.status_code == 503
        self._assert_no_pii_in_response(response.text)

    def test_429_claude_rate_limit_does_not_leak_pii(self, client):
        """429 from Claude rate limit must not leak PII."""
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] is unhappy",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeRateLimitError("Rate limit"),
            ),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": self.PII_THOUGHT},
            )

        assert response.status_code == 429
        self._assert_no_pii_in_response(response.text)

    def test_502_claude_api_error_does_not_leak_pii(self, client):
        """502 from Claude API error must not leak PII."""
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="[person] at [company] is unhappy",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
                side_effect=ClaudeAPIError("Claude API error"),
            ),
        ):
            response = client.post(
                "/api/v1/thoughts",
                json={"text": self.PII_THOUGHT},
            )

        assert response.status_code == 502
        self._assert_no_pii_in_response(response.text)

    def test_validation_error_422_is_returned_for_oversized_input(self, client):
        """
        Pydantic validation failures for oversized input must return 422.
        The response may include the input value (FastAPI default behaviour),
        but the important requirement is the correct status code.
        """
        oversized_thought = "a" * 1001

        response = client.post(
            "/api/v1/thoughts",
            json={"text": oversized_thought},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Confirm it's a string length error
        errors = data["detail"]
        assert any(
            "string_too_long" in str(e.get("type", "")) or "max_length" in str(e).lower()
            for e in errors
        )

    def test_multiple_failure_types_consistently_safe(self, client):
        """
        Across multiple distinct failure types, raw text is never exposed.
        This is a regression sweep test.
        """
        raw_input = "My colleague David at Google cheated on his expense report"

        failure_scenarios = [
            # (patch_target, side_effect, expected_status)
            (
                "routers.thoughts.anonymiser_service.anonymize_text",
                OllamaConnectionError("down"),
                503,
            ),
            (
                "routers.thoughts.anonymiser_service.anonymize_text",
                OllamaTimeoutError("timeout"),
                503,
            ),
            (
                "routers.thoughts.anonymiser_service.anonymize_text",
                OllamaResponseError("bad response"),
                502,
            ),
        ]

        for patch_target, side_effect, expected_status in failure_scenarios:
            with patch(
                patch_target,
                new_callable=AsyncMock,
                side_effect=side_effect,
            ):
                response = client.post(
                    "/api/v1/thoughts",
                    json={"text": raw_input},
                )

            assert response.status_code == expected_status, (
                f"Expected {expected_status} for {side_effect.__class__.__name__}, "
                f"got {response.status_code}"
            )
            _assert_no_raw_text_in_response(response.text, raw_input)
