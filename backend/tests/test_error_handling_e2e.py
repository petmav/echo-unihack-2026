"""
End-to-end test for error handling when Ollama is unavailable.

This test verifies subtask-3-2 requirements:
1. Service returns HTTP 503 when Ollama is unavailable
2. Error message does NOT contain raw input text (privacy check)
3. Service recovers when Ollama is restored

IMPORTANT: This test can run in two modes:
1. Unit test mode (default): Mocks the httpx client to simulate Ollama unavailability
2. E2E mode: Actually tests with Ollama service (requires manual stop/start)
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from fastapi.testclient import TestClient
from main import app
from services.anonymiser import (
    AnonymiserService,
    OllamaConnectionError,
    OllamaTimeoutError,
)


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestErrorHandlingWithOllamaUnavailable:
    """
    Test error handling when Ollama service is unavailable.

    These tests verify that the API gracefully handles Ollama failures
    and never exposes raw input text in error messages (privacy requirement).
    """

    def test_api_returns_503_when_ollama_unavailable(self, client):
        """
        Test that API returns HTTP 503 Service Unavailable when Ollama is down.

        This test mocks the anonymiser service to simulate Ollama connection failure.
        """
        # Sensitive test data - should NOT appear in error response
        test_input = {
            "text": "My boss David at CIA headquarters undermines me constantly"
        }

        # Mock the anonymiser service to raise OllamaConnectionError
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.anonymise.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            mock_get_service.return_value = mock_service

            # Make the request
            response = client.post("/api/v1/anonymise", json=test_input)

            # Verify HTTP status code
            assert response.status_code == 503, \
                f"Expected HTTP 503, got {response.status_code}"

            # Verify response contains error detail
            response_data = response.json()
            assert "detail" in response_data, "Response should contain error detail"

    def test_api_returns_504_when_ollama_times_out(self, client):
        """Test that API returns HTTP 504 Gateway Timeout when Ollama times out."""
        test_input = {
            "text": "My colleague Sarah at FBI headquarters is difficult to work with"
        }

        # Mock the anonymiser service to raise OllamaTimeoutError
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.anonymise.side_effect = OllamaTimeoutError(
                "Anonymization request timed out after 2.0 seconds"
            )
            mock_get_service.return_value = mock_service

            # Make the request
            response = client.post("/api/v1/anonymise", json=test_input)

            # Verify HTTP status code
            assert response.status_code == 504, \
                f"Expected HTTP 504, got {response.status_code}"

    def test_error_message_does_not_contain_raw_input(self, client):
        """
        CRITICAL PRIVACY TEST: Verify error messages never contain raw input text.

        This ensures that even in failure scenarios, sensitive PII is never leaked.
        """
        # Highly sensitive test data with PII
        sensitive_keywords = ["David", "CIA", "headquarters", "undermines"]
        test_input = {
            "text": "My boss David at CIA headquarters undermines me constantly"
        }

        # Mock the anonymiser service to raise an error
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.anonymise.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            mock_get_service.return_value = mock_service

            # Make the request
            response = client.post("/api/v1/anonymise", json=test_input)

            # Get the full response as string
            response_text = response.text.lower()

            # Verify NONE of the sensitive keywords appear in the error response
            for keyword in sensitive_keywords:
                assert keyword.lower() not in response_text, \
                    f"PRIVACY VIOLATION: Sensitive keyword '{keyword}' found in error response"

    def test_error_messages_are_user_friendly(self, client):
        """Test that error messages are descriptive and user-friendly."""
        test_input = {"text": "Test thought"}

        # Mock connection error
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.anonymise.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/anonymise", json=test_input)
            response_data = response.json()

            # Verify error message is descriptive
            assert "detail" in response_data
            detail = response_data["detail"].lower()

            # Should mention "unavailable" or "service"
            assert "unavailable" in detail or "service" in detail, \
                "Error message should be descriptive"

    def test_multiple_failures_in_sequence(self, client):
        """
        Test that multiple consecutive failures are handled consistently.

        Verifies that error handling doesn't degrade after repeated failures.
        """
        test_inputs = [
            {"text": "First sensitive thought with name Alice"},
            {"text": "Second sensitive thought with company Google"},
            {"text": "Third sensitive thought with location Paris"},
        ]

        # Mock the anonymiser service to always fail
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.anonymise.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            mock_get_service.return_value = mock_service

            for test_input in test_inputs:
                response = client.post("/api/v1/anonymise", json=test_input)

                # Each request should still return 503
                assert response.status_code == 503

                # Privacy check: no raw text in any error
                response_text = response.text.lower()
                for word in test_input["text"].split():
                    if len(word) > 3:  # Check meaningful words
                        # Some generic words might appear in error messages,
                        # but specific PII should not
                        if word.lower() in ["alice", "google", "paris"]:
                            assert word.lower() not in response_text


class TestServiceRecovery:
    """
    Test that the service recovers gracefully when Ollama becomes available again.

    These tests verify that after Ollama connection failures, the service can
    successfully process requests once Ollama is restored.
    """

    @pytest.mark.asyncio
    async def test_service_can_recover_after_connection_failure(self):
        """
        Test that AnonymiserService can make successful requests after a failure.

        This simulates the scenario where Ollama is temporarily down and then restored.
        """
        # Create a service instance
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="eternisai/anonymizer-0.6b-q4_k_m-gguf",
            timeout_seconds=2.0
        )

        # Mock the client to simulate failure then success
        with patch.object(service.client, 'post') as mock_post:
            # First call fails (Ollama down)
            mock_post.side_effect = httpx.ConnectError(
                "Connection refused"
            )

            with pytest.raises(OllamaConnectionError):
                await service.anonymise("Test text during failure")

            # Second call succeeds (Ollama restored)
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "response": "Test [anonymised] text"
            }
            mock_post.side_effect = None
            mock_post.return_value = mock_response

            # Should succeed now
            result = await service.anonymise("Test text after recovery")
            assert result == "Test [anonymised] text"

        await service.close()

    def test_api_recovers_after_ollama_restored(self, client):
        """
        Test that the API endpoint works correctly after Ollama is restored.

        This test simulates:
        1. Ollama is down (returns 503)
        2. Ollama comes back up (returns 200)
        """
        test_input = {"text": "My colleague bothers me"}

        # Mock service to fail first, then succeed
        with patch('main.get_anonymiser_service') as mock_get_service:
            mock_service = AsyncMock()

            # First call: Ollama unavailable
            mock_service.anonymise.side_effect = OllamaConnectionError(
                "Anonymizer service unavailable. Please ensure Ollama is running."
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/anonymise", json=test_input)
            assert response.status_code == 503

            # Second call: Ollama available
            mock_service.anonymise.side_effect = None
            mock_service.anonymise.return_value = "My [colleague] bothers me"

            response = client.post("/api/v1/anonymise", json=test_input)
            assert response.status_code == 200

            response_data = response.json()
            assert "anonymised_text" in response_data
            assert response_data["anonymised_text"] == "My [colleague] bothers me"


# Manual E2E test instructions (requires Ollama to actually be stopped/started)
"""
MANUAL E2E VERIFICATION:

To run the full end-to-end verification with actual Ollama service:

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
      curl -X POST http://localhost:8000/api/v1/anonymise \\
           -H 'Content-Type: application/json' \\
           -d '{"text":"My boss David at Google undermines me"}'

   d. Verify no PII in error message (should NOT contain "David" or "Google")

   e. Restart Ollama:
      sudo systemctl start ollama
      # or: ollama serve &

   f. Test again (should return 200 with anonymised text):
      curl -X POST http://localhost:8000/api/v1/anonymise \\
           -H 'Content-Type: application/json' \\
           -d '{"text":"My boss David at Google undermines me"}'

Expected results:
- Step c: HTTP 503 with error message "Anonymizer service unavailable"
- Step d: Error message contains NO raw input text (David, Google)
- Step f: HTTP 200 with anonymised placeholders ([male name], [tech company])
"""
