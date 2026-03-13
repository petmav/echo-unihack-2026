"""
Unit tests for the AI service (NanoGPT via httpx).

These tests verify the humanization and theme classification pipeline
without requiring a live NanoGPT API connection.

Key invariants verified:
- humanize_thought() returns non-empty text on success
- classify_theme() falls back to "other" on unrecognised theme labels
- classify_theme() and humanize_thought() raise ValueError for empty input
- Correct exception types are raised for rate-limit/API errors
- Invalid theme responses fall back to "other"
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from services.ai import (
    ClaudeAPIError,
    ClaudeRateLimitError,
    classify_theme,
    humanize_thought,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_ANONYMIZED_TEXT = "My [male name] at [tech company] undermines me"
SAMPLE_HUMANIZED_TEXT = (
    "Someone at work consistently undermines me in front of others, "
    "and it's eroding my confidence in myself."
)


def _mock_nanogpt_response(text: str, status_code: int = 200) -> MagicMock:
    """Create a mock httpx response for the NanoGPT API."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = {
        "choices": [{"message": {"content": text}}]
    }
    return mock_response


def _build_mock_client(response: MagicMock) -> AsyncMock:
    """Build a mock httpx.AsyncClient usable as an async context manager."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def _patch_nanogpt(mock_client: AsyncMock):
    """Return a patch context manager targeting httpx.AsyncClient in services.ai."""
    return patch("services.ai.httpx.AsyncClient", return_value=mock_client)


# ---------------------------------------------------------------------------
# humanize_thought() tests
# ---------------------------------------------------------------------------

class TestHumanizeThought:
    """Tests for humanize_thought()."""

    @pytest.mark.asyncio
    async def test_returns_humanized_text_on_success(self):
        """humanize_thought should return the text from the API response."""
        mock_client = _build_mock_client(_mock_nanogpt_response(SAMPLE_HUMANIZED_TEXT))

        with _patch_nanogpt(mock_client):
            result = await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

        assert result == SAMPLE_HUMANIZED_TEXT

    @pytest.mark.asyncio
    async def test_strips_whitespace_from_response(self):
        """humanize_thought should strip leading/trailing whitespace from the output."""
        padded_text = f"  {SAMPLE_HUMANIZED_TEXT}  \n"
        mock_client = _build_mock_client(_mock_nanogpt_response(padded_text))

        with _patch_nanogpt(mock_client):
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
    async def test_raises_claude_rate_limit_error_on_429(self):
        """humanize_thought should raise ClaudeRateLimitError on HTTP 429."""
        mock_client = _build_mock_client(_mock_nanogpt_response("", status_code=429))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeRateLimitError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_500(self):
        """humanize_thought should raise ClaudeAPIError on HTTP 500."""
        mock_client = _build_mock_client(_mock_nanogpt_response("", status_code=500))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_when_content_empty(self):
        """humanize_thought should raise ClaudeAPIError when API returns empty content."""
        mock_client = _build_mock_client(_mock_nanogpt_response(""))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_when_text_is_blank(self):
        """humanize_thought should raise ClaudeAPIError when API returns blank text."""
        mock_client = _build_mock_client(_mock_nanogpt_response("   "))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_strips_input_before_sending_to_api(self):
        """humanize_thought should strip the input text before passing it to the API."""
        mock_client = _build_mock_client(_mock_nanogpt_response(SAMPLE_HUMANIZED_TEXT))

        with _patch_nanogpt(mock_client):
            result = await humanize_thought(f"  {SAMPLE_ANONYMIZED_TEXT}  ")

        assert result == SAMPLE_HUMANIZED_TEXT
        # Verify the message content posted had the text stripped
        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        user_message = payload["messages"][1]["content"]
        assert user_message == SAMPLE_ANONYMIZED_TEXT

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_connect_error(self):
        """humanize_thought should raise ClaudeAPIError on connection failure."""
        mock_client = _build_mock_client(_mock_nanogpt_response(""))
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_timeout(self):
        """humanize_thought should raise ClaudeAPIError on request timeout."""
        mock_client = _build_mock_client(_mock_nanogpt_response(""))
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await humanize_thought(SAMPLE_ANONYMIZED_TEXT)


# ---------------------------------------------------------------------------
# classify_theme() tests
# ---------------------------------------------------------------------------

class TestClassifyTheme:
    """Tests for classify_theme()."""

    @pytest.mark.asyncio
    async def test_returns_valid_theme_on_success(self):
        """classify_theme should return the theme from the API response."""
        mock_client = _build_mock_client(_mock_nanogpt_response("work_stress"))

        with _patch_nanogpt(mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "work_stress"

    @pytest.mark.asyncio
    async def test_normalises_theme_to_lowercase(self):
        """classify_theme should lowercase the theme returned by the API."""
        mock_client = _build_mock_client(_mock_nanogpt_response("Work_Stress"))

        with _patch_nanogpt(mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "work_stress"

    @pytest.mark.asyncio
    async def test_raises_value_error_for_empty_input(self):
        """classify_theme should raise ValueError for empty input."""
        with pytest.raises(ValueError):
            await classify_theme("")

    @pytest.mark.asyncio
    async def test_raises_value_error_for_whitespace_input(self):
        """classify_theme should raise ValueError for whitespace-only input."""
        with pytest.raises(ValueError):
            await classify_theme("   \n\t  ")

    @pytest.mark.asyncio
    async def test_raises_claude_rate_limit_error_on_429(self):
        """classify_theme should raise ClaudeRateLimitError on HTTP 429."""
        mock_client = _build_mock_client(_mock_nanogpt_response("", status_code=429))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeRateLimitError):
                await classify_theme(SAMPLE_HUMANIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_500(self):
        """classify_theme should raise ClaudeAPIError on HTTP 500."""
        mock_client = _build_mock_client(_mock_nanogpt_response("", status_code=500))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await classify_theme(SAMPLE_HUMANIZED_TEXT)

    @pytest.mark.asyncio
    async def test_falls_back_to_other_on_invalid_theme(self):
        """classify_theme should return 'other' when API returns unknown theme."""
        mock_client = _build_mock_client(_mock_nanogpt_response("made_up_theme_xyz"))

        with _patch_nanogpt(mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == "other"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("theme", [
        "work_stress",
        "burnout",
        "career_uncertainty",
        "workplace_conflict",
        "relationship_conflict",
        "loneliness",
        "family_tension",
        "friendship_issues",
        "romantic_heartbreak",
        "self_doubt",
        "low_self_esteem",
        "identity_confusion",
        "perfectionism",
        "general_anxiety",
        "social_anxiety",
        "depression",
        "grief",
        "overwhelm",
        "life_purpose",
        "existential_dread",
        "future_uncertainty",
        "self_harm",
        "suicidal_ideation",
        "crisis",
        "substance_abuse",
        "eating_disorder",
        "abuse",
        "domestic_violence",
        "other",
    ])
    async def test_accepts_all_valid_themes(self, theme: str):
        """classify_theme should accept every valid theme returned by the API."""
        mock_client = _build_mock_client(_mock_nanogpt_response(theme))

        with _patch_nanogpt(mock_client):
            result = await classify_theme(SAMPLE_HUMANIZED_TEXT)

        assert result == theme

    @pytest.mark.asyncio
    async def test_uses_correct_model(self):
        """humanize_thought should call the API with the expected model name."""
        mock_client = _build_mock_client(_mock_nanogpt_response(SAMPLE_HUMANIZED_TEXT))

        with _patch_nanogpt(mock_client):
            await humanize_thought(SAMPLE_ANONYMIZED_TEXT)

        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        assert payload["model"] == "qwen3.5-122b-a10b"

    @pytest.mark.asyncio
    async def test_classify_uses_correct_model(self):
        """classify_theme should call the API with the expected model name."""
        mock_client = _build_mock_client(_mock_nanogpt_response("work_stress"))

        with _patch_nanogpt(mock_client):
            await classify_theme(SAMPLE_HUMANIZED_TEXT)

        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        assert payload["model"] == "qwen3.5-122b-a10b"

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_connect_error(self):
        """classify_theme should raise ClaudeAPIError on connection failure."""
        mock_client = _build_mock_client(_mock_nanogpt_response(""))
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await classify_theme(SAMPLE_HUMANIZED_TEXT)

    @pytest.mark.asyncio
    async def test_raises_claude_api_error_on_timeout(self):
        """classify_theme should raise ClaudeAPIError on request timeout."""
        mock_client = _build_mock_client(_mock_nanogpt_response(""))
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        with _patch_nanogpt(mock_client):
            with pytest.raises(ClaudeAPIError):
                await classify_theme(SAMPLE_HUMANIZED_TEXT)
