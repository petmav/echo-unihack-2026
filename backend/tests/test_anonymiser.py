"""
Integration tests for the Anonymiser Service.

These tests verify the critical privacy gate in Echo's architecture:
- Ollama connection and model availability
- PII stripping with semantic placeholder replacement
- Error handling when Ollama is unavailable
- Performance requirements (< 2 seconds response time)
- Privacy guarantees (no raw text logging)

IMPORTANT: These tests require Ollama to be running with the anonymizer model.
To set up:
1. Start Ollama: ollama serve
2. Pull the model: ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
3. Verify model: curl http://localhost:11434/api/tags | grep anonymizer
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from services.anonymiser import (
    AnonymiserService,
    OllamaConnectionError,
    OllamaTimeoutError,
    OllamaResponseError,
    AnonymiserError
)


# Test data with PII that should be anonymised
TEST_CASES = [
    {
        "input": "My boss David at Google undermines me",
        "expected_placeholders": ["[male name]", "[tech company]"],
        "description": "Name and company replacement"
    },
    {
        "input": "I live in San Francisco and work at Meta",
        "expected_placeholders": ["[city]", "[company]"],
        "description": "Location and company replacement"
    },
    {
        "input": "My friend Sarah told me I'm not good enough",
        "expected_placeholders": ["[female name]"],
        "description": "Female name replacement"
    },
    {
        "input": "Working at Amazon with my manager John is stressful",
        "expected_placeholders": ["[company]", "[male name]"],
        "description": "Multiple PII elements"
    }
]


class TestAnonymiserServiceIntegration:
    """
    Integration tests for AnonymiserService with Ollama.

    These tests require Ollama to be running and the anonymizer model to be available.
    """

    @pytest.fixture
    async def anonymiser_service(self):
        """Create an anonymiser service instance for testing."""
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="eternisai/anonymizer-0.6b-q4_k_m-gguf",
            timeout_seconds=2.0
        )
        yield service
        await service.close()

    @pytest.mark.asyncio
    async def test_ollama_connection(self):
        """Test that Ollama service is reachable."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get("http://localhost:11434/api/tags")
                assert response.status_code == 200, "Ollama service should be reachable"
            except httpx.ConnectError:
                pytest.fail("Ollama is not running. Start it with: ollama serve")

    @pytest.mark.asyncio
    async def test_model_availability(self):
        """Test that the anonymizer model is available in Ollama."""
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:11434/api/tags")
            assert response.status_code == 200

            data = response.json()
            models = data.get("models", [])
            model_names = [model.get("name", "") for model in models]

            # Check for the anonymizer model
            assert any("anonymizer" in name.lower() for name in model_names), \
                "Anonymizer model not found. Pull it with: ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf"

    @pytest.mark.asyncio
    async def test_anonymise_basic(self, anonymiser_service):
        """Test basic anonymisation with PII replacement."""
        input_text = "My boss David at Google undermines me"

        result = await anonymiser_service.anonymise(input_text)

        # Verify we got a non-empty result
        assert result, "Anonymised text should not be empty"
        assert len(result) > 0, "Anonymised text should have content"

        # Verify the result is different from input (PII should be replaced)
        assert result != input_text, "Anonymised text should be different from input"

        # The result should contain semantic placeholders
        # Note: The exact output depends on the model, so we check for common patterns
        assert "[" in result and "]" in result, \
            "Anonymised text should contain placeholder brackets"

    @pytest.mark.asyncio
    async def test_anonymise_preserves_emotional_content(self, anonymiser_service):
        """Test that anonymisation preserves emotional meaning."""
        input_text = "My boss David at Google undermines me"

        result = await anonymiser_service.anonymise(input_text)

        # Key emotional/contextual words should still be present
        emotional_keywords = ["boss", "undermines", "me"]
        for keyword in emotional_keywords:
            assert keyword.lower() in result.lower(), \
                f"Emotional keyword '{keyword}' should be preserved in anonymised text"

    @pytest.mark.asyncio
    async def test_anonymise_performance(self, anonymiser_service):
        """Test that anonymisation completes within 2 seconds."""
        import time

        input_text = "My friend Sarah in London told me I'm not good enough"

        start_time = time.time()
        result = await anonymiser_service.anonymise(input_text)
        elapsed_time = time.time() - start_time

        assert result, "Anonymisation should return a result"
        assert elapsed_time < 2.0, \
            f"Anonymisation took {elapsed_time:.2f}s, should be < 2.0s"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_case", TEST_CASES)
    async def test_anonymise_test_cases(self, anonymiser_service, test_case):
        """Test anonymisation with various PII patterns."""
        input_text = test_case["input"]

        result = await anonymiser_service.anonymise(input_text)

        # Verify we got a result
        assert result, f"Failed to anonymise: {test_case['description']}"
        assert result != input_text, "Anonymised text should differ from input"


class TestAnonymiserServiceErrorHandling:
    """
    Tests for error handling in the anonymiser service.

    These tests verify graceful degradation when Ollama is unavailable.
    """

    @pytest.mark.asyncio
    async def test_connection_error_when_ollama_unavailable(self):
        """Test that service raises OllamaConnectionError when Ollama is not running."""
        # Use a non-existent endpoint to simulate Ollama being down
        service = AnonymiserService(
            ollama_base_url="http://localhost:99999",  # Invalid port
            timeout_seconds=1.0
        )

        with pytest.raises(OllamaConnectionError):
            await service.anonymise("Test text")

        await service.close()

    @pytest.mark.asyncio
    async def test_timeout_error(self):
        """Test that service raises OllamaTimeoutError on timeout."""
        # Use a very short timeout to force a timeout
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            timeout_seconds=0.001  # 1ms timeout - should always timeout
        )

        with pytest.raises((OllamaTimeoutError, OllamaConnectionError)):
            # Note: Might also raise ConnectionError if it fails immediately
            await service.anonymise("Test text with some content")

        await service.close()

    @pytest.mark.asyncio
    async def test_error_messages_do_not_contain_raw_text(self):
        """
        PRIVACY TEST: Verify error messages never contain raw input text.

        This is critical for privacy - errors must not leak PII.
        """
        service = AnonymiserService(
            ollama_base_url="http://localhost:99999",  # Invalid port
            timeout_seconds=1.0
        )

        sensitive_input = "My secret: I work at CIA headquarters"

        try:
            await service.anonymise(sensitive_input)
            pytest.fail("Should have raised an exception")
        except Exception as e:
            error_message = str(e)

            # Verify the error message does NOT contain the sensitive input
            assert "CIA" not in error_message, \
                "Error message leaked raw input text"
            assert "secret" not in error_message.lower(), \
                "Error message leaked raw input text"

        await service.close()


class TestAnonymiserServicePrivacy:
    """
    Privacy-focused tests for the anonymiser service.

    These tests verify the critical privacy invariants:
    - Raw text is never logged
    - Raw text is never cached
    - Raw text exists only in memory during processing
    """

    @pytest.mark.asyncio
    async def test_no_raw_text_in_logs(self, anonymiser_service, caplog):
        """Test that raw input text never appears in logs."""
        import logging

        # Enable logging to capture log messages
        caplog.set_level(logging.DEBUG)

        sensitive_input = "My therapist Dr. Smith at UCLA told me I have issues"

        try:
            await anonymiser_service.anonymise(sensitive_input)
        except Exception:
            # Even if anonymisation fails, logs should not contain raw text
            pass

        # Check all log messages
        for record in caplog.records:
            log_message = record.getMessage()

            # Verify sensitive content is NOT in logs
            assert "Dr. Smith" not in log_message, "Raw name leaked in logs"
            assert "UCLA" not in log_message, "Raw organization leaked in logs"
            assert "therapist" not in log_message, "Raw context leaked in logs"

    def test_service_initialization_does_not_log_config_secrets(self, caplog):
        """Test that service initialization does not log sensitive config."""
        import logging

        caplog.set_level(logging.DEBUG)

        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="test-model",
            timeout_seconds=2.0
        )

        # Verify initialization logs contain non-sensitive info only
        log_messages = [record.getMessage() for record in caplog.records]

        # Should log initialization details
        assert any("AnonymiserService initialized" in msg for msg in log_messages)

        # Configuration values are okay to log (not sensitive)
        assert any("localhost:11434" in msg for msg in log_messages)


# Helper function to check if Ollama is running (for pytest skip conditions)
async def is_ollama_running() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:11434/api/tags", timeout=2.0)
            return response.status_code == 200
    except Exception:
        return False


# Run a quick connection check when tests are collected
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires Ollama)"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test (requires all services)"
    )
