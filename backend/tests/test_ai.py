"""
Unit tests for the Claude AI service.

These tests verify the humanization and theme classification pipeline
without requiring a live Anthropic API connection.

Key invariants verified:
- humanize_thought() returns non-empty text on success
- classify_theme() falls back to "general_anxiety" on any error
- Correct exception types are raised for auth/rate-limit/API errors
- Empty input is handled gracefully without API calls
- Invalid theme responses from Claude fall back to "general_anxiety"
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import services.ai as ai_module
from services.ai import (
    humanize_thought,
    classify_theme,
    AIServiceError,
    AIAuthError,
    AIRateLimitError,
    AIResponseError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_ANONYMIZED_TEXT = "My [male name] at [tech company] undermines me"
SAMPLE_HUMANIZED_TEXT = (
    "Someone at work consistently undermines me in front of others, "
    "and it's eroding my confidence in myself."
)


def _make_message_response(text: str) -> MagicMock:
    """Build a mock Anthropic Message response with a single text block."""
    content_block = MagicMock()
    content_block.text = text

    message = MagicMock()
    message.content = [content_block]
    return message


def _make_empty_message_response() -> MagicMock:
    """Build a mock Anthropic Message response with no content blocks."""
    message = MagicMock()
    message.content = []
    return message


# ---------------------------------------------------------------------------
# humanize_thought() tests
# ---------------------------------------------------------------------------

class TestHumanizeThought:
    """Tests for humanize_thought()."""

    @pytest.mark.asyncio
    async def test_returns_humanized_text_on_success(self):
        """humanize_thought should return the text from Claude's response."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response(SAMPLE_HUMANIZED_TEXT)
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

        assert result == SAMPLE_HUMANIZED_TEXT

    @pytest.mark.asyncio
    async def test_strips_whitespace_from_response(self):
        """humanize_thought should strip leading/trailing whitespace from Claude's output."""
        padded_text = f"  {SAMPLE_HUMANIZED_TEXT}  \n"
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response(padded_text)
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

        assert result == SAMPLE_HUMANIZED_TEXT

    @pytest.mark.asyncio
    async def test_raises_value_error_for_empty_input(self):
        """humanize_thought should raise ValueError if input is empty."""
        with pytest.raises(ValueError):
            await humanize_thought("")

    @pytest.mark.asyncio
    async def test_raises_value_error_for_whitespace_only_input(self):
        """humanize_thought should raise ValueError if input is only whitespace."""
        with pytest.raises(ValueError):
            await humanize_thought("   \n\t  ")

    @pytest.mark.asyncio
    async def test_raises_ai_auth_error_on_authentication_error(self):
        """humanize_thought should raise AIAuthError on Anthropic AuthenticationError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.AuthenticationError(
                message="invalid x-api-key",
                response=MagicMock(status_code=401, headers={}),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            with pytest.raises(AIAuthError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_ai_rate_limit_error_on_rate_limit(self):
        """humanize_thought should raise AIRateLimitError on Anthropic RateLimitError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.RateLimitError(
                message="rate limit exceeded",
                response=MagicMock(status_code=429, headers={}),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            with pytest.raises(AIRateLimitError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_ai_service_error_on_api_error(self):
        """humanize_thought should raise AIServiceError on generic Anthropic APIError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.APIError(
                message="internal server error",
                request=MagicMock(),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            with pytest.raises(AIServiceError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_ai_response_error_when_content_empty(self):
        """humanize_thought should raise AIResponseError when Claude returns no content."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_empty_message_response()
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            with pytest.raises(AIResponseError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_ai_response_error_when_text_is_blank(self):
        """humanize_thought should raise AIResponseError when Claude returns blank text."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response("   ")
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            with pytest.raises(AIResponseError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_strips_input_before_sending_to_claude(self):
        """humanize_thought should strip the input text before passing it to Claude."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response(SAMPLE_HUMANIZED_TEXT)
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await humanize_thought(f"  {SAMPLE_ANONYMIZED_TEXT}  ")

        assert result == SAMPLE_HUMANIZED_TEXT
        # Verify the message content passed to Claude had the text stripped
        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]
        assert SAMPLE_ANONYMIZED_TEXT in messages[0]["content"]


# ---------------------------------------------------------------------------
# classify_theme() tests
# ---------------------------------------------------------------------------

class TestClassifyTheme:
    """Tests for classify_theme()."""

    @pytest.mark.asyncio
    async def test_returns_valid_theme_on_success(self):
        """classify_theme should return the theme from Claude's response."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response("work_stress")
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "work_stress"

    @pytest.mark.asyncio
    async def test_normalises_theme_to_lowercase(self):
        """classify_theme should lowercase the theme returned by Claude."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response("Work_Stress")
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "work_stress"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_for_empty_input(self):
        """classify_theme should return 'general_anxiety' for empty input without API call."""
        result = await classify_theme("")
        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_for_whitespace_input(self):
        """classify_theme should return 'general_anxiety' for whitespace-only input."""
        result = await classify_theme("   \n\t  ")
        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_on_authentication_error(self):
        """classify_theme should return 'general_anxiety' on AuthenticationError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.AuthenticationError(
                message="invalid x-api-key",
                response=MagicMock(status_code=401, headers={}),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_on_rate_limit_error(self):
        """classify_theme should return 'general_anxiety' on RateLimitError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.RateLimitError(
                message="rate limit exceeded",
                response=MagicMock(status_code=429, headers={}),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_on_api_error(self):
        """classify_theme should return 'general_anxiety' on generic APIError."""
        import anthropic

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.APIError(
                message="internal server error",
                request=MagicMock(),
                body={},
            )
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_on_empty_content(self):
        """classify_theme should return 'general_anxiety' when Claude returns no content."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_empty_message_response()
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "general_anxiety"

    @pytest.mark.asyncio
    async def test_falls_back_to_general_anxiety_on_invalid_theme(self):
        """classify_theme should return 'general_anxiety' when Claude returns unknown theme."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response("made_up_theme_xyz")
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "general_anxiety"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("theme", [
        "work_stress",
        "anxiety",
        "loneliness",
        "relationship_conflict",
        "self_worth",
        "grief",
        "family_pressure",
        "burnout",
        "fear_of_failure",
        "social_anxiety",
        "self_harm",
        "suicidal_ideation",
        "crisis",
        "substance_abuse",
        "eating_disorder",
        "abuse",
        "domestic_violence",
        "general_anxiety",
    ])
    async def test_accepts_all_valid_themes(self, theme: str):
        """classify_theme should accept every valid theme returned by Claude."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response(theme)
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == theme

    @pytest.mark.asyncio
    async def test_uses_correct_model(self):
        """humanize_thought should call Claude with the expected model name."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response(SAMPLE_HUMANIZED_TEXT)
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_classify_uses_correct_model(self):
        """classify_theme should call Claude with the expected model name."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_message_response("work_stress")
        )

        with patch("services.ai.anthropic.AsyncAnthropic", return_value=mock_client):
            await classify_theme(SAMPLE_HUMANIZED_TEXT)

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-sonnet-4-20250514"
