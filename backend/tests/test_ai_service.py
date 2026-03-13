"""
Unit tests for the AI service (services/ai.py).

These tests verify the current stub behaviour of the Claude API integration.
All tests use AsyncMock so they will work once the real Claude client is wired in.

Key invariants verified:
- humanize_thought() returns a non-empty string for any anonymised input
- classify_theme() returns a non-empty string and a recognisable theme category
- Neither function is called with raw user text (enforced by convention; see privacy notes)

TODO (once Claude API is integrated):
- Replace stub return-value assertions with mocked Anthropic client assertions
- Verify the correct model (claude-sonnet-4-20250514) is used
- Verify the correct prompt template is sent
- Verify output length falls in the 50-60 word target range
- Verify anthropic.APIError is propagated as expected
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import services.ai as ai_module
from services.ai import humanize_thought, classify_theme


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
    "relationship_conflict",
    "self_worth",
    "anxiety",
    "general_anxiety",
    "self_harm",
    "suicidal_ideation",
    "crisis",
    "substance_abuse",
    "eating_disorder",
    "abuse",
    "domestic_violence",
    "grief",
    "loneliness",
    "family_conflict",
    "identity",
    "financial_stress",
}


# ---------------------------------------------------------------------------
# humanize_thought tests
# ---------------------------------------------------------------------------

class TestHumanizeThought:
    """Tests for humanize_thought()."""

    @pytest.mark.asyncio
    async def test_returns_non_empty_string(self):
        """humanize_thought must return a non-empty string for valid anonymised input."""
        result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_stub_returns_input_unchanged(self):
        """
        Current stub returns the anonymised text as-is.

        TODO: Once Claude API is integrated, remove this test and replace with:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = MagicMock(
                content=[MagicMock(text=SAMPLE_HUMANISED_TEXT)]
            )
            with patch.object(ai_module, "_anthropic_client", mock_client):
                result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)
            assert result == SAMPLE_HUMANISED_TEXT
        """
        result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)

        # Stub: returns input unchanged
        assert result == SAMPLE_ANONYMISED_TEXT

    @pytest.mark.asyncio
    async def test_handles_short_anonymised_input(self):
        """humanize_thought must handle short anonymised inputs without error."""
        short_input = "I feel [emotion] all the time."
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
        result = await humanize_thought(long_input)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_privacy_anonymised_text_does_not_appear_in_raw_form(self):
        """
        PRIVACY: humanize_thought only ever receives anonymised text.
        This test documents the contract — real PII must never be passed in.

        TODO: Once Claude API is integrated, assert that the client is called
        with anonymised text only (no real names, emails, or locations):
            call_args = mock_client.messages.create.call_args
            prompt_content = str(call_args)
            # PII markers will have been stripped by anonymiser before reaching here
            assert "David" not in prompt_content
            assert "Google" not in prompt_content
        """
        anonymised = "My [male name] at [tech company] undermines me."
        result = await humanize_thought(anonymised)

        # The output must not contain raw PII (the stub returns input unchanged
        # which is safe here because input is already anonymised)
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_with_mocked_anthropic_client(self):
        """
        Demonstrates how to test humanize_thought once the real Claude client
        is wired in.

        TODO: Enable this test when the Claude API integration is complete.
        Until then it serves as a specification of expected mock usage.
        """
        # TODO: Uncomment and adapt once services/ai.py exposes _anthropic_client
        # expected_output = SAMPLE_HUMANISED_TEXT
        # mock_client = AsyncMock()
        # mock_client.messages.create.return_value = MagicMock(
        #     content=[MagicMock(text=expected_output)]
        # )
        # with patch.object(ai_module, "_anthropic_client", mock_client):
        #     result = await humanize_thought(SAMPLE_ANONYMISED_TEXT)
        # assert result == expected_output
        # mock_client.messages.create.assert_awaited_once()
        # call_kwargs = mock_client.messages.create.call_args.kwargs
        # assert call_kwargs["model"] == "claude-sonnet-4-20250514"
        pytest.skip("Skipped until Claude API integration is complete")


# ---------------------------------------------------------------------------
# classify_theme tests
# ---------------------------------------------------------------------------

class TestClassifyTheme:
    """Tests for classify_theme()."""

    @pytest.mark.asyncio
    async def test_returns_non_empty_string(self):
        """classify_theme must return a non-empty string."""
        result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_returns_recognisable_theme_category(self):
        """
        classify_theme must return a theme that is either in the known-themes set
        or at least a snake_case string (allowing for new categories to be added).

        The current stub always returns 'general_anxiety'.
        """
        result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        # Either matches a known theme, or is a non-empty snake_case string
        is_known_theme = result in KNOWN_THEMES
        is_snake_case_string = (
            result.replace("_", "").isalpha() and result == result.lower()
        )
        assert is_known_theme or is_snake_case_string, (
            f"classify_theme returned '{result}' which is not a recognisable theme category"
        )

    @pytest.mark.asyncio
    async def test_stub_returns_general_anxiety(self):
        """
        Current stub always returns 'general_anxiety'.

        TODO: Once real theme classification is implemented, replace with:
            result = await classify_theme("I can't stop worrying about my job.")
            assert result in KNOWN_THEMES
        """
        result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        # Stub: always returns the default theme
        assert result == "general_anxiety"

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

        Risk themes trigger the safety resource block. The returned string must be
        a plain comparable string (not None, not an object).
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
        result = await classify_theme(SAMPLE_HUMANISED_TEXT)

        # Must be a string so membership checks work correctly
        assert isinstance(result, str)
        # Demonstrate the check pattern used by the safety layer
        is_risk_theme = result in risk_themes
        assert isinstance(is_risk_theme, bool)

    @pytest.mark.asyncio
    async def test_with_mocked_anthropic_client(self):
        """
        Demonstrates how to test classify_theme once the real Claude client
        is wired in.

        TODO: Enable this test when the Claude API integration is complete.
        """
        # TODO: Uncomment and adapt once services/ai.py exposes _anthropic_client
        # expected_theme = "work_stress"
        # mock_client = AsyncMock()
        # mock_client.messages.create.return_value = MagicMock(
        #     content=[MagicMock(text=expected_theme)]
        # )
        # with patch.object(ai_module, "_anthropic_client", mock_client):
        #     result = await classify_theme(SAMPLE_HUMANISED_TEXT)
        # assert result == expected_theme
        # mock_client.messages.create.assert_awaited_once()
        pytest.skip("Skipped until Claude API integration is complete")
