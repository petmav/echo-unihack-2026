"""
Unit tests for the AI service (services/ai.py).

These tests verify the NanoGPT API integration using mocked httpx clients.
All tests use AsyncMock so they run without a live API connection.

Key invariants verified:
- humanize_thought() returns a non-empty string for any anonymised input
- classify_theme() returns a recognisable theme category
- Neither function is called with raw user text (enforced by convention)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.ai import classify_theme, humanize_thought

# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

SAMPLE_ANONYMISED_TEXT = (
    "My [male name] at [tech company] consistently undermines me in front of my peers."
)
SAMPLE_HUMANISED_TEXT = (
    "Someone at work consistently undermines me in front of others, "
    "and it's eroding my confidence in myself."
)

# Known theme categories used throughout the app
KNOWN_THEMES = {
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
}


def _mock_nanogpt_response(text: str, status_code: int = 200):
    """Build a mock httpx Response matching the NanoGPT chat completions format."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = {"choices": [{"message": {"content": text}}]}
    return mock_response


def _make_mock_client(response_text: str, status_code: int = 200):
    """Create a fully configured mock httpx.AsyncClient with async context manager support."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        return_value=_mock_nanogpt_response(response_text, status_code)
    )
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ---------------------------------------------------------------------------
# humanize_thought tests
# ---------------------------------------------------------------------------

class TestHumanizeThought:
    """Tests for humanize_thought()."""

    @pytest.mark.asyncio
    async def test_returns_non_empty_string(self):
        """humanize_thought must return a non-empty string for valid anonymised input."""
        mock_client = _make_mock_client(SAMPLE_HUMANISED_TEXT)

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_returns_claude_response_text(self):
        """humanize_thought returns the text from the API response."""
        mock_client = _make_mock_client(SAMPLE_HUMANISED_TEXT)

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)

        assert result == SAMPLE_HUMANISED_TEXT

    @pytest.mark.asyncio
    async def test_handles_short_anonymised_input(self):
        """humanize_thought must handle short anonymised inputs without error."""
        short_input = "I feel [emotion] all the time."
        mock_client = _make_mock_client("I feel this emotion all the time.")

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await humanize_thought(short_input)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_handles_longer_anonymised_input(self):
        """humanize_thought must handle multi-sentence anonymised inputs."""
        long_input = (
            "My [female name] left me after [number] years. "
            "I work at [company] and I struggle to focus. "
            "I have not told [family member] how I feel."
        )
        expected = "Someone important left after many years and I struggle to cope."
        mock_client = _make_mock_client(expected)

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await humanize_thought(long_input)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_privacy_anonymised_text_does_not_contain_raw_pii(self):
        """
        PRIVACY: humanize_thought only ever receives anonymised text.
        The anonymised input must not contain raw PII markers.
        """
        anonymised = "My [male name] at [tech company] undermines me."
        mock_client = _make_mock_client(SAMPLE_HUMANISED_TEXT)

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await humanize_thought(anonymised)

        assert isinstance(result, str)
        # Verify no raw PII was in the input that was sent to the API
        call_kwargs = mock_client.post.call_args.kwargs
        payload = call_kwargs["json"]
        messages = payload["messages"]
        user_message = messages[1]["content"]
        assert "David" not in user_message
        assert "Google" not in user_message


# ---------------------------------------------------------------------------
# classify_theme tests
# ---------------------------------------------------------------------------

class TestClassifyTheme:
    """Tests for classify_theme()."""

    @pytest.mark.asyncio
    async def test_returns_non_empty_string(self):
        """classify_theme must return a non-empty string."""
        mock_client = _make_mock_client("work_stress")

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_returns_recognisable_theme_category(self):
        """
        classify_theme must return a theme from the known-themes set
        (or 'other' for unrecognised labels).
        """
        mock_client = _make_mock_client("work_stress")

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        assert result in KNOWN_THEMES, (
            f"classify_theme returned '{result}' which is not a recognisable theme category"
        )

    @pytest.mark.asyncio
    async def test_falls_back_to_other_for_unrecognised_theme(self):
        """classify_theme falls back to 'other' when the API returns an unknown label."""
        mock_client = _make_mock_client("some_made_up_theme")

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        assert result == "other"

    @pytest.mark.asyncio
    async def test_returns_string_for_varied_inputs(self):
        """classify_theme must return a string regardless of input content."""
        inputs = [
            "I feel completely alone and no one understands me.",
            "Work is overwhelming and I cannot cope with the pressure.",
            "My relationship is falling apart and I don't know what to do.",
            "I keep having thoughts that scare me.",
        ]
        for text in inputs:
            mock_client = _make_mock_client("general_anxiety")

            with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
                result = await classify_theme(text)

            assert isinstance(result, str), (
                f"classify_theme returned non-string for input: '{text}'"
            )
            assert len(result.strip()) > 0, (
                f"classify_theme returned empty string for input: '{text}'"
            )

    @pytest.mark.asyncio
    async def test_theme_can_be_used_for_safety_guardrail_check(self):
        """
        The returned theme string must be comparable to the risk-theme set used by
        the 'Guardrails of Care' safety layer on the frontend.
        """
        risk_themes = {
            "self_harm",
            "suicidal_ideation",
            "crisis",
            "substance_abuse",
            "eating_disorder",
            "abuse",
            "domestic_violence",
        }
        mock_client = _make_mock_client("work_stress")

        with patch("services.ai.httpx.AsyncClient", return_value=mock_client):
            result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        # Must be a string so membership checks work correctly
        assert isinstance(result, str)
        # Demonstrate the check pattern used by the safety layer
        is_risk_theme = result in risk_themes
        assert isinstance(is_risk_theme, bool)
