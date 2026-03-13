"""
Unit tests for the AnonymiserService.

These tests verify correctness and privacy guarantees of all anonymiser
operations without requiring a live Ollama instance.

Key invariants verified:
- Happy path: correct response parsing returns anonymised text
- OllamaConnectionError raised on httpx.ConnectError
- OllamaTimeoutError raised on httpx.TimeoutException
- OllamaResponseError raised on non-200 HTTP status
- Fallback to original text on empty/unparseable model output
- OllamaResponseError raised on malformed JSON (response.json() failure)
- Error messages NEVER contain raw input text (privacy guarantee)
- Module-level helpers anonymize_text() and validate_anonymization() work correctly
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from services.anonymiser import (
    AnonymiserService,
    OllamaConnectionError,
    OllamaResponseError,
    OllamaTimeoutError,
    anonymize_text,
    validate_anonymization,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_RAW_TEXT = "My boss David at Google undermines me constantly."
SAMPLE_ANONYMISED_TEXT = "My boss [male name] at [tech company] undermines me constantly."
SAMPLE_MODEL_OUTPUT = '{"replacements": [{"original": "David", "replacement": "[male name]"}, {"original": "Google", "replacement": "[tech company]"}]}'


def _make_mock_response(status_code: int = 200, json_data: dict | None = None) -> MagicMock:
    """Return a minimal mock httpx.Response."""
    response = MagicMock()
    response.status_code = status_code
    if json_data is not None:
        response.json.return_value = json_data
    else:
        response.json.side_effect = Exception("No JSON body")
    return response


def _make_service() -> AnonymiserService:
    """Return an AnonymiserService configured for testing."""
    return AnonymiserService(
        ollama_base_url="http://localhost:11434",
        model_name="test-model",
        timeout_seconds=2.0,
    )


# ---------------------------------------------------------------------------
# AnonymiserService.anonymise — happy path
# ---------------------------------------------------------------------------

class TestAnonymiserServiceHappyPath:
    """Tests for successful AnonymiserService.anonymise() calls."""

    @pytest.mark.asyncio
    async def test_returns_anonymised_text_on_success(self):
        """anonymise() should return the anonymised text on a valid 200 response."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": SAMPLE_MODEL_OUTPUT}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            result = await service.anonymise(SAMPLE_RAW_TEXT)

        assert result == SAMPLE_ANONYMISED_TEXT

    @pytest.mark.asyncio
    async def test_strips_whitespace_from_response(self):
        """anonymise() should strip leading/trailing whitespace from the model output."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": "  " + SAMPLE_MODEL_OUTPUT + "\n"}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            result = await service.anonymise(SAMPLE_RAW_TEXT)

        assert result == SAMPLE_ANONYMISED_TEXT

    @pytest.mark.asyncio
    async def test_posts_to_correct_url(self):
        """anonymise() should POST to <base_url>/api/chat."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": SAMPLE_MODEL_OUTPUT}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            await service.anonymise(SAMPLE_RAW_TEXT)

        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://localhost:11434/api/chat"

    @pytest.mark.asyncio
    async def test_payload_contains_model_and_stream_false(self):
        """anonymise() payload must include model name, messages list, and stream=False."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": SAMPLE_MODEL_OUTPUT}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            await service.anonymise(SAMPLE_RAW_TEXT)

        call_kwargs = mock_client.post.call_args.kwargs
        payload = call_kwargs["json"]
        assert payload["model"] == "test-model"
        assert payload["stream"] is False
        assert isinstance(payload["messages"], list)
        assert len(payload["messages"]) >= 2
        assert payload["messages"][0]["role"] == "system"
        assert payload["messages"][1]["role"] == "user"


# ---------------------------------------------------------------------------
# AnonymiserService.anonymise — error cases
# ---------------------------------------------------------------------------

class TestAnonymiserServiceErrors:
    """Tests for error handling in AnonymiserService.anonymise()."""

    @pytest.mark.asyncio
    async def test_raises_connection_error_on_connect_error(self):
        """OllamaConnectionError must be raised when httpx.ConnectError occurs."""
        service = _make_service()
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaConnectionError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_raises_timeout_error_on_timeout_exception(self):
        """OllamaTimeoutError must be raised when httpx.TimeoutException occurs."""
        service = _make_service()
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("Request timed out")

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaTimeoutError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_raises_connection_error_on_request_error(self):
        """OllamaConnectionError must be raised when httpx.RequestError (other) occurs."""
        service = _make_service()
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.RequestError("Network error")

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaConnectionError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_raises_response_error_on_non_200_status(self):
        """OllamaResponseError must be raised when Ollama returns a non-200 HTTP status."""
        service = _make_service()
        mock_response = _make_mock_response(status_code=503)
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_raises_response_error_on_500_status(self):
        """OllamaResponseError must be raised for a 500 Internal Server Error."""
        service = _make_service()
        mock_response = _make_mock_response(status_code=500)
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_falls_back_to_original_on_empty_response_body(self):
        """anonymise() should fall back to original text when model returns empty content."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": ""}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            result = await service.anonymise(SAMPLE_RAW_TEXT)

        assert result == SAMPLE_RAW_TEXT

    @pytest.mark.asyncio
    async def test_falls_back_to_original_on_whitespace_only_response(self):
        """anonymise() should fall back to original text when model returns only whitespace."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": "   "}},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            result = await service.anonymise(SAMPLE_RAW_TEXT)

        assert result == SAMPLE_RAW_TEXT

    @pytest.mark.asyncio
    async def test_raises_response_error_on_malformed_json(self):
        """OllamaResponseError must be raised when Ollama returns malformed JSON."""
        service = _make_service()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = Exception("JSON decode error")
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError):
                await service.anonymise(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_raises_response_error_on_missing_message_key(self):
        """OllamaResponseError must be raised when JSON has no 'message' key."""
        service = _make_service()
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"model": "test-model", "done": True},
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError):
                await service.anonymise(SAMPLE_RAW_TEXT)


# ---------------------------------------------------------------------------
# Privacy tests: error messages must not leak raw input text
# ---------------------------------------------------------------------------

class TestAnonymiserPrivacy:
    """
    PRIVACY TESTS: Verify that error messages never contain the raw input text.

    This is a critical safety invariant — raw PII-containing text must never
    appear in logs, exception messages, or any other output.
    """

    @pytest.mark.asyncio
    async def test_connection_error_message_does_not_contain_raw_text(self):
        """OllamaConnectionError message must NOT include the raw input text."""
        service = _make_service()
        sensitive_text = "My boss David Smith at MegaCorp fires me."
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("refused")

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaConnectionError) as exc_info:
                await service.anonymise(sensitive_text)

        assert sensitive_text not in str(exc_info.value)
        assert "David Smith" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_timeout_error_message_does_not_contain_raw_text(self):
        """OllamaTimeoutError message must NOT include the raw input text."""
        service = _make_service()
        sensitive_text = "I hate my colleague Jane Doe at Acme Corp."
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("timed out")

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaTimeoutError) as exc_info:
                await service.anonymise(sensitive_text)

        assert sensitive_text not in str(exc_info.value)
        assert "Jane Doe" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_response_error_non_200_does_not_contain_raw_text(self):
        """OllamaResponseError on non-200 status must NOT include raw input text."""
        service = _make_service()
        sensitive_text = "My manager Bob at TechCorp dismissed my ideas."
        mock_response = _make_mock_response(status_code=503)
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError) as exc_info:
                await service.anonymise(sensitive_text)

        assert sensitive_text not in str(exc_info.value)
        assert "Bob" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_response_error_non_200_does_not_contain_raw_text_sensitive(self):
        """OllamaResponseError on non-200 must NOT include raw input text (sensitive variant)."""
        service = _make_service()
        sensitive_text = "My therapist Dr. Alice recommended I change jobs."
        mock_response = _make_mock_response(status_code=502)
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError) as exc_info:
                await service.anonymise(sensitive_text)

        assert sensitive_text not in str(exc_info.value)
        assert "Alice" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_response_error_malformed_json_does_not_contain_raw_text(self):
        """OllamaResponseError on malformed JSON must NOT include raw input text."""
        service = _make_service()
        sensitive_text = "My partner Sarah and I are having serious problems."
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = Exception("bad json")
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch.object(service, "_get_client", return_value=mock_client):
            with pytest.raises(OllamaResponseError) as exc_info:
                await service.anonymise(sensitive_text)

        assert sensitive_text not in str(exc_info.value)
        assert "Sarah" not in str(exc_info.value)


# ---------------------------------------------------------------------------
# AnonymiserService lifecycle tests
# ---------------------------------------------------------------------------

class TestAnonymiserServiceLifecycle:
    """Tests for AnonymiserService client lifecycle management."""

    @pytest.mark.asyncio
    async def test_close_releases_client(self):
        """close() should call aclose() on the underlying httpx client."""
        service = _make_service()
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        service._client = mock_http_client

        await service.close()

        mock_http_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_does_nothing_when_client_none(self):
        """close() must not raise when no client has been created."""
        service = _make_service()
        service._client = None

        # Should not raise
        await service.close()

    @pytest.mark.asyncio
    async def test_close_does_nothing_when_client_already_closed(self):
        """close() must not call aclose() if the client is already closed."""
        service = _make_service()
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = True
        service._client = mock_http_client

        await service.close()

        mock_http_client.aclose.assert_not_called()


# ---------------------------------------------------------------------------
# Module-level helper: anonymize_text()
# ---------------------------------------------------------------------------

class TestAnonymizeText:
    """Tests for the module-level anonymize_text() convenience function."""

    @pytest.mark.asyncio
    async def test_returns_anonymised_text_on_success(self):
        """anonymize_text() should return the anonymised string on success."""
        mock_response = _make_mock_response(
            status_code=200,
            json_data={"message": {"content": SAMPLE_MODEL_OUTPUT}},
        )
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        mock_http_client.post.return_value = mock_response

        with patch("services.anonymiser.httpx.AsyncClient", return_value=mock_http_client):
            result = await anonymize_text(SAMPLE_RAW_TEXT)

        assert result == SAMPLE_ANONYMISED_TEXT

    @pytest.mark.asyncio
    async def test_propagates_connection_error(self):
        """anonymize_text() must propagate OllamaConnectionError from the service."""
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        mock_http_client.post.side_effect = httpx.ConnectError("refused")

        with patch("services.anonymiser.httpx.AsyncClient", return_value=mock_http_client):
            with pytest.raises(OllamaConnectionError):
                await anonymize_text(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_propagates_timeout_error(self):
        """anonymize_text() must propagate OllamaTimeoutError from the service."""
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        mock_http_client.post.side_effect = httpx.TimeoutException("timeout")

        with patch("services.anonymiser.httpx.AsyncClient", return_value=mock_http_client):
            with pytest.raises(OllamaTimeoutError):
                await anonymize_text(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_propagates_response_error(self):
        """anonymize_text() must propagate OllamaResponseError on bad response."""
        mock_response = _make_mock_response(status_code=500)
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        mock_http_client.post.return_value = mock_response

        with patch("services.anonymiser.httpx.AsyncClient", return_value=mock_http_client):
            with pytest.raises(OllamaResponseError):
                await anonymize_text(SAMPLE_RAW_TEXT)

    @pytest.mark.asyncio
    async def test_closes_service_even_on_error(self):
        """anonymize_text() must close the service client even when an error occurs."""
        mock_http_client = AsyncMock()
        mock_http_client.is_closed = False
        mock_http_client.post.side_effect = httpx.ConnectError("refused")

        with patch("services.anonymiser.httpx.AsyncClient", return_value=mock_http_client):
            with pytest.raises(OllamaConnectionError):
                await anonymize_text(SAMPLE_RAW_TEXT)

        # aclose must have been called in the finally block
        mock_http_client.aclose.assert_called_once()


# ---------------------------------------------------------------------------
# Module-level helper: validate_anonymization()
# ---------------------------------------------------------------------------

class TestValidateAnonymization:
    """Tests for the module-level validate_anonymization() convenience function."""

    @pytest.mark.asyncio
    async def test_returns_true_for_non_empty_anonymised_text(self):
        """validate_anonymization() returns True when anonymised text is non-empty."""
        result = await validate_anonymization(SAMPLE_RAW_TEXT, SAMPLE_ANONYMISED_TEXT)
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_for_empty_anonymised_text(self):
        """validate_anonymization() returns False when anonymised text is empty."""
        result = await validate_anonymization(SAMPLE_RAW_TEXT, "")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_for_whitespace_only_anonymised_text(self):
        """validate_anonymization() returns False when anonymised text is only whitespace."""
        result = await validate_anonymization(SAMPLE_RAW_TEXT, "   ")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_true_regardless_of_original_text(self):
        """validate_anonymization() result depends only on anonymised text, not original."""
        result = await validate_anonymization("", SAMPLE_ANONYMISED_TEXT)
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_true_for_single_character_anonymised(self):
        """validate_anonymization() returns True for a minimal non-empty anonymised string."""
        result = await validate_anonymization(SAMPLE_RAW_TEXT, "x")
        assert result is True
