"""
End-to-end style tests for error handling when Ollama is unavailable.

These tests use the real FastAPI test client against the actual
POST /api/v1/thoughts endpoint (the only endpoint that invokes the anonymiser).

NOTE: The /api/v1/anonymise endpoint does NOT exist. All anonymisation happens
internally via the POST /api/v1/thoughts pipeline.

Tests verify:
1. HTTP 503 is returned when Ollama is unavailable
2. Raw input text NEVER appears in error responses (privacy invariant)
3. The service handles errors consistently across multiple requests
4. The service processes requests successfully once Ollama is restored

See test_error_handling.py for comprehensive unit tests with broader coverage.
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from services.anonymiser import (
    AnonymiserService,
    OllamaConnectionError,
    OllamaTimeoutError,
)


class TestErrorHandlingWithOllamaUnavailable:
    """
    Test error handling when Ollama service is unavailable.

    These tests verify that POST /api/v1/thoughts gracefully handles Ollama
    failures and never exposes raw input text in error messages.
    """

    def test_api_returns_503_when_ollama_unavailable(self, client):
        """
        POST /api/v1/thoughts must return HTTP 503 when Ollama is down.

        The anonymiser step is first in the pipeline; connection failure
        propagates as 503 Service Unavailable.
        """
        test_input = {
            "text": "My boss David at CIA headquarters undermines me constantly"
        }

        # Mock the anonymiser service to raise OllamaConnectionError
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )

            # Make the request
            response = client.post("/api/v1/thoughts", json=test_input)

        assert response.status_code == 503, (
            f"Expected HTTP 503, got {response.status_code}"
        )

        response_data = response.json()
        assert "detail" in response_data, "Response should contain error detail"

    def test_api_returns_503_when_ollama_times_out(self, client):
        """Test that API returns HTTP 503 when Ollama times out."""
        test_input = {
            "text": "My colleague Sarah at FBI headquarters is difficult to work with"
        }

        # Mock the anonymiser service to raise OllamaTimeoutError
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaTimeoutError(
                "Anonymization request timed out after 2.0 seconds"
            )

            # Make the request
            response = client.post("/api/v1/thoughts", json=test_input)

            # Verify HTTP status code (router returns 503 for all Ollama failures)
            assert response.status_code == 503, \
                f"Expected HTTP 503, got {response.status_code}"

    def test_error_message_does_not_contain_raw_input(self, client):
        """
        CRITICAL PRIVACY TEST: Verify error messages never contain raw input text.

        Even in failure scenarios, sensitive PII must never be echoed back in
        the HTTP error response.
        """
        sensitive_keywords = ["David", "CIA", "headquarters", "undermines"]
        test_input = {
            "text": "My boss David at CIA headquarters undermines me constantly"
        }

        # Mock the anonymiser service to raise an error
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            response = client.post("/api/v1/thoughts", json=test_input)

        response_text = response.text.lower()
        for keyword in sensitive_keywords:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: Sensitive keyword '{keyword}' found in error response"
            )

    def test_error_messages_are_user_friendly(self, client):
        """Test that error messages are descriptive and user-friendly."""
        test_input = {"text": "Test thought"}

        # Mock connection error
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )

            response = client.post("/api/v1/thoughts", json=test_input)
            response_data = response.json()

        assert "detail" in response_data
        detail = response_data["detail"].lower()

        # Should communicate service unavailability
        assert "unavailable" in detail or "service" in detail or "try again" in detail, (
            "Error message should be descriptive and user-friendly"
        )

    def test_multiple_failures_in_sequence(self, client):
        """
        Multiple consecutive Ollama failures must all return 503 consistently.

        Verifies that error handling does not degrade after repeated failures
        and that PII is never leaked across any of the requests.
        """
        test_inputs = [
            {"text": "First sensitive thought with name Alice"},
            {"text": "Second sensitive thought with company Google"},
            {"text": "Third sensitive thought with location Paris"},
        ]
        # Mock the anonymiser service to always fail
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )

            for test_input in test_inputs:
                response = client.post("/api/v1/thoughts", json=test_input)

                assert response.status_code == 503, (
                    f"Expected 503 but got {response.status_code} for input: {test_input}"
                )

                response_text = response.text.lower()
                for word in test_input["text"].split():
                    if len(word) > 3:  # Check meaningful words
                        # Some generic words might appear in error messages,
                        # but specific PII should not
                        if word.lower() in ["alice", "google", "paris"]:
                            assert word.lower() not in response_text


class TestServiceRecovery:
    """
    Test that the service processes requests correctly after Ollama is restored.

    These tests verify that after Ollama connection failures, the API can
    successfully process requests once Ollama is available again.
    """

    @pytest.mark.asyncio
    async def test_anonymiser_service_recovers_after_connection_failure(self):
        """
        AnonymiserService must be able to make successful requests after a failure.

        Simulates Ollama being temporarily down then restored by patching the
        underlying httpx client calls.
        """
        # Create a service instance and initialise its internal HTTP client
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="qwen3.5:0.8b",
            timeout_seconds=2.0,
        )

        # Force-initialise the internal client so we can patch its post method
        internal_client = service._get_client()

        with patch.object(internal_client, "post", new_callable=AsyncMock) as mock_post:
            # First call fails (Ollama down)
            mock_post.side_effect = httpx.ConnectError("Connection refused")

            with pytest.raises(OllamaConnectionError):
                await service.anonymise("Test text during failure")

            # Second call: Ollama restored (successful response)
            # httpx.Response.json() is synchronous, so use MagicMock not AsyncMock
            from unittest.mock import MagicMock  # noqa: PLC0415
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "message": {"content": '{"replacements": []}'}
            }
            mock_post.side_effect = None
            mock_post.return_value = mock_response

            result = await service.anonymise("Test text after recovery")
            assert result == "Test text after recovery"

        await service.close()

    def test_api_recovers_after_ollama_restored(self, client):
        """
        POST /api/v1/thoughts must work correctly after Ollama is restored.

        Simulates:
        1. Ollama is down → 503
        2. Ollama comes back up → 200 with valid result
        """
        test_input = {"text": "My colleague bothers me"}

        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
            ) as mock_anon,
            patch(
                "routers.thoughts.ai.humanize_thought",
                new_callable=AsyncMock,
            ) as mock_humanize,
            patch(
                "routers.thoughts.ai.classify_theme",
                new_callable=AsyncMock,
            ) as mock_classify,
            patch(
                "routers.thoughts.elastic.index_thought",
                new_callable=AsyncMock,
            ) as mock_index,
            patch(
                "routers.thoughts.elastic.search_similar_thoughts",
                new_callable=AsyncMock,
            ) as mock_search,
        ):
            # First call: Ollama unavailable
            mock_anon.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )

            response = client.post("/api/v1/thoughts", json=test_input)
            assert response.status_code == 503

            # Second call: Ollama available — configure all downstream mocks
            mock_anon.side_effect = None
            mock_anon.return_value = "My [colleague] bothers me"
            mock_humanize.return_value = "A colleague is causing me ongoing stress."
            mock_classify.return_value = "work_stress"
            mock_index.return_value = True
            mock_search.return_value = {
                "thoughts": [],
                "total": 5,
                "search_after": None,
            }

            response = client.post("/api/v1/thoughts", json=test_input)
            assert response.status_code == 200

            response_data = response.json()
            assert "message_id" in response_data
            assert "theme_category" in response_data
            assert response_data["theme_category"] == "work_stress"


# ---------------------------------------------------------------------------
# Manual E2E verification instructions (not automated)
# ---------------------------------------------------------------------------
"""
MANUAL E2E VERIFICATION:

To verify error handling with a real Ollama instance:

1. Start the backend server:
   cd backend && uvicorn main:app --reload

2. Run the automated verification script:
   ./backend/verify_error_handling.sh

3. Or manually:
   a. Verify Ollama is running:
      curl http://localhost:11434/api/tags

   b. Stop Ollama:
      sudo systemctl stop ollama
      # or: pkill -f ollama

   c. Test the endpoint (should return 503):
      curl -X POST http://localhost:8000/api/v1/thoughts \\
           -H 'Content-Type: application/json' \\
           -d '{"raw_text":"My boss David at Google undermines me"}'

   d. Verify no PII in error message (must NOT contain "David" or "Google")

   e. Restart Ollama:
      sudo systemctl start ollama
      # or: ollama serve &

   f. Test again (should return 200 with anonymised text):
      curl -X POST http://localhost:8000/api/v1/thoughts \\
           -H 'Content-Type: application/json' \\
           -d '{"raw_text":"My boss David at Google undermines me"}'

Expected results:
- Step c: HTTP 503 with error message "Anonymization service unavailable"
- Step d: Error message contains NO raw input text (David, Google)
- Step f: HTTP 200 with ThoughtSubmitResult (message_id, theme_category, match_count, similar_thoughts)
"""
