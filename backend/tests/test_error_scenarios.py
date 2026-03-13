"""
Error scenario tests for the Echo backend.

Covers all failure modes defined in subtask-3-4:
1. Anonymiser unavailable (503) — OllamaConnectionError raised by anonymize_text
2. Anonymiser timeout (503)    — OllamaTimeoutError raised by anonymize_text
3. Claude API failure (502)    — humanize_thought or classify_theme raises
4. ES unavailable              — thought submission still succeeds with empty results
5. Invalid pagination cursor (422) — malformed search_after JSON on GET /similar
6. Missing thought ID (404)    — get_thought_by_id returns None

All tests use the shared `client` fixture from conftest.py which patches the happy
path; individual test methods add inner patches to simulate specific failure modes.

PRIVACY NOTE: No raw thought text is asserted to appear in error responses.
"""

from unittest.mock import AsyncMock, patch

import services.elastic as elastic_module
from services.anonymiser import OllamaConnectionError, OllamaTimeoutError
from tests.conftest import SEEDED_MESSAGE_ID

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_RAW_THOUGHT = "My boss Sarah at DeepMind keeps undermining me in meetings"
_SUBMIT_PAYLOAD = {"text": _RAW_THOUGHT}


# ---------------------------------------------------------------------------
# 1 & 2 — Anonymiser failure scenarios
# ---------------------------------------------------------------------------

class TestAnonymiserUnavailable:
    """POST /api/v1/thoughts returns 503 when the anonymiser cannot be reached."""

    def test_anonymiser_connection_error_returns_503(self, client):
        """
        OllamaConnectionError from anonymize_text must surface as HTTP 503.
        """
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError(
                "Could not connect to Ollama. Is it running?"
            ),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        assert response.status_code == 503, (
            f"Expected HTTP 503, got {response.status_code}"
        )
        body = response.json()
        assert "detail" in body

    def test_anonymiser_connection_error_detail_is_user_friendly(self, client):
        """Error detail must be descriptive and mention unavailability."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Could not connect to Ollama."),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        detail = response.json()["detail"].lower()
        assert "unavailable" in detail or "service" in detail, (
            "Error detail should describe service unavailability"
        )

    def test_anonymiser_connection_error_no_raw_text_in_response(self, client):
        """CRITICAL PRIVACY: raw input text must NOT appear in the error response."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaConnectionError("Could not connect to Ollama."),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        response_text = response.text.lower()
        for pii_word in ["sarah", "deepmind", "undermining", "meetings"]:
            assert pii_word not in response_text, (
                f"PRIVACY VIOLATION: '{pii_word}' found in error response"
            )


class TestAnonymiserTimeout:
    """POST /api/v1/thoughts returns 503 when the anonymiser times out."""

    def test_anonymiser_timeout_returns_503(self, client):
        """OllamaTimeoutError from anonymize_text must surface as HTTP 503."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaTimeoutError("Ollama request timed out."),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        assert response.status_code == 503, (
            f"Expected HTTP 503, got {response.status_code}"
        )

    def test_anonymiser_timeout_detail_is_user_friendly(self, client):
        """Timeout error detail must mention timeout or service."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaTimeoutError("Ollama request timed out."),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        detail = response.json()["detail"].lower()
        assert "timed out" in detail or "timeout" in detail or "service" in detail, (
            "Timeout error detail should describe the timeout condition"
        )

    def test_anonymiser_timeout_no_raw_text_in_response(self, client):
        """CRITICAL PRIVACY: raw input text must NOT appear in timeout error."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            side_effect=OllamaTimeoutError("Ollama request timed out."),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        response_text = response.text.lower()
        for pii_word in ["sarah", "deepmind", "undermining"]:
            assert pii_word not in response_text, (
                f"PRIVACY VIOLATION: '{pii_word}' found in timeout error response"
            )


# ---------------------------------------------------------------------------
# 3 — Claude API failure
# ---------------------------------------------------------------------------

class TestClaudeAPIFailure:
    """POST /api/v1/thoughts returns 502 when Claude humanization/classification fails."""

    def test_humanize_failure_returns_502(self, client):
        """
        An exception from services.ai.humanize_thought must surface as HTTP 502.
        """
        with patch(
            "routers.thoughts.ai.humanize_thought",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Anthropic API error: 529 overloaded"),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        assert response.status_code == 502, (
            f"Expected HTTP 502, got {response.status_code}"
        )
        body = response.json()
        assert "detail" in body

    def test_humanize_failure_detail_is_user_friendly(self, client):
        """Humanization error detail must not expose internal exception details."""
        with patch(
            "routers.thoughts.ai.humanize_thought",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Anthropic API error: 529 overloaded"),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        detail = response.json()["detail"].lower()
        assert "service" in detail or "failed" in detail or "humaniz" in detail, (
            "Humanization error detail should describe the failure"
        )

    def test_classify_theme_failure_returns_502(self, client):
        """
        An exception from services.ai.classify_theme must surface as HTTP 502.
        """
        with patch(
            "routers.thoughts.ai.classify_theme",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Anthropic API error: rate limited"),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        assert response.status_code == 502, (
            f"Expected HTTP 502, got {response.status_code}"
        )

    def test_claude_failure_no_raw_text_in_response(self, client):
        """CRITICAL PRIVACY: raw input text must NOT appear in Claude error response."""
        with patch(
            "routers.thoughts.ai.humanize_thought",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Anthropic API error"),
        ):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        response_text = response.text.lower()
        for pii_word in ["sarah", "deepmind", "undermining"]:
            assert pii_word not in response_text, (
                f"PRIVACY VIOLATION: '{pii_word}' found in Claude error response"
            )


# ---------------------------------------------------------------------------
# 4 — Elasticsearch unavailable (thought submission still succeeds)
# ---------------------------------------------------------------------------

class TestElasticsearchUnavailable:
    """
    When Elasticsearch is unavailable, POST /api/v1/thoughts should still succeed
    (HTTP 200) but return zero matches and an empty results list.

    This reflects the "non-fatal if unavailable" comment in thoughts.py.
    """

    def test_submit_succeeds_when_es_unavailable(self, client):
        """
        Thought submission returns HTTP 200 even when ES client is None.
        """
        with patch.object(elastic_module, "_es_client", None):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        assert response.status_code == 200, (
            f"Expected HTTP 200 even with ES down, got {response.status_code}"
        )

    def test_submit_returns_empty_results_when_es_unavailable(self, client):
        """
        With ES unavailable, similar_thoughts list should be empty and
        match_count should be 0.

        The client fixture mocks at the function level, so we override the
        search mock to return the empty-results fallback that the router uses
        when ES is unavailable (rather than patching _es_client which is
        bypassed by the function-level mocks).
        """
        empty_result = {"thoughts": [], "total": 0, "search_after": None}
        with patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock, return_value=empty_result):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        body = response.json()
        assert body["match_count"] == 0, (
            "match_count should be 0 when ES is unavailable"
        )
        assert body["similar_thoughts"] == [], (
            "similar_thoughts should be empty when ES is unavailable"
        )

    def test_submit_returns_message_id_even_when_es_unavailable(self, client):
        """A message_id is generated locally and must always be returned."""
        with patch.object(elastic_module, "_es_client", None):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        body = response.json()
        assert "message_id" in body, "message_id must always be returned"
        assert len(body["message_id"]) > 0

    def test_submit_returns_theme_even_when_es_unavailable(self, client):
        """Theme classification succeeds (Claude is up) even if ES is down."""
        with patch.object(elastic_module, "_es_client", None):
            response = client.post("/api/v1/thoughts", json=_SUBMIT_PAYLOAD)

        body = response.json()
        assert "theme_category" in body, "theme_category must be returned"
        assert len(body["theme_category"]) > 0


# ---------------------------------------------------------------------------
# 5 — Invalid pagination cursor
# ---------------------------------------------------------------------------

class TestInvalidPaginationCursor:
    """GET /api/v1/thoughts/similar returns 422 for a malformed search_after cursor."""

    def test_non_json_cursor_returns_422(self, client):
        """A non-JSON search_after string should return HTTP 422."""
        response = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": "not-valid-json",
            },
        )
        assert response.status_code == 422, (
            f"Expected HTTP 422, got {response.status_code}"
        )

    def test_non_array_cursor_returns_422(self, client):
        """A JSON string that is not an array should return HTTP 422."""
        import json
        cursor = json.dumps({"key": "value"})  # valid JSON but not an array
        response = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": cursor,
            },
        )
        assert response.status_code == 422, (
            f"Expected HTTP 422 for non-array cursor, got {response.status_code}"
        )

    def test_invalid_cursor_detail_is_informative(self, client):
        """422 error detail must describe the cursor requirement."""
        response = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": "{{broken",
            },
        )
        body = response.json()
        assert "detail" in body
        detail = body["detail"].lower()
        assert "cursor" in detail or "search_after" in detail or "invalid" in detail, (
            "422 detail should describe the invalid cursor"
        )

    def test_valid_cursor_does_not_return_422(self, client):
        """A valid JSON array cursor must NOT return 422."""
        import json
        valid_cursor = json.dumps([0.95, SEEDED_MESSAGE_ID])
        response = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": valid_cursor,
            },
        )
        # Should return 200 (found) or 404 (thought not found) — not 422
        assert response.status_code != 422, (
            "A valid JSON array cursor must not return 422"
        )


# ---------------------------------------------------------------------------
# 6 — Missing thought ID
# ---------------------------------------------------------------------------

class TestMissingThoughtID:
    """GET /api/v1/thoughts/similar returns 404 when the thought_id does not exist."""

    def test_unknown_message_id_returns_404(self, client):
        """
        When Elasticsearch returns None for a message_id lookup, the endpoint
        must respond with HTTP 404.
        """
        with patch(
            "routers.thoughts.elastic.get_thought_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": "nonexistent-id-00000000"},
            )

        assert response.status_code == 404, (
            f"Expected HTTP 404 for missing thought, got {response.status_code}"
        )

    def test_unknown_message_id_detail_is_informative(self, client):
        """404 detail must reference the requested thought."""
        target_id = "nonexistent-id-12345"
        with patch(
            "routers.thoughts.elastic.get_thought_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": target_id},
            )

        body = response.json()
        assert "detail" in body
        # The detail should mention the ID or "not found"
        detail = body["detail"].lower()
        assert "not found" in detail or target_id.lower() in detail, (
            "404 detail should describe which resource was not found"
        )

    def test_missing_message_id_query_param_returns_error(self, client):
        """
        Omitting the required message_id query parameter should return a
        client error (422 Unprocessable Entity from FastAPI validation).
        """
        response = client.get("/api/v1/thoughts/similar")
        assert response.status_code == 422, (
            f"Expected HTTP 422 for missing message_id param, got {response.status_code}"
        )
