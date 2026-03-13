"""
Claude API service for humanizing anonymized thoughts.

Uses Anthropic Claude API (claude-sonnet-4-20250514) to convert anonymized
thoughts into natural, empathetic 50-60 word expressions.

CRITICAL: This service MUST ONLY receive anonymized text. It must NEVER
be passed raw user thoughts. The anonymiser service is always called first.

Example:
    Input (anonymized):  "My [male name] at [tech company] undermines me"
    Output (humanized):  "Someone at work consistently undermines me in front
                         of others, and it's eroding my confidence in myself."

Privacy guarantee: Claude API only ever receives text that has already been
processed by the anonymizer. No raw thoughts, no PII.
"""

import anthropic

from config import config


# ---------------------------------------------------------------------------
# Valid theme categories
# ---------------------------------------------------------------------------

VALID_THEMES: list[str] = [
    # Work & career
    "work_stress",
    "burnout",
    "career_uncertainty",
    "workplace_conflict",
    # Relationships
    "relationship_conflict",
    "loneliness",
    "family_tension",
    "friendship_issues",
    "romantic_heartbreak",
    # Identity & self
    "self_doubt",
    "low_self_esteem",
    "identity_confusion",
    "perfectionism",
    # Anxiety & mood
    "general_anxiety",
    "social_anxiety",
    "depression",
    "grief",
    "overwhelm",
    # Existential
    "life_purpose",
    "existential_dread",
    "future_uncertainty",
    # Crisis & safety (trigger safety resource banner)
    "self_harm",
    "suicidal_ideation",
    "crisis",
    "substance_abuse",
    "eating_disorder",
    "abuse",
    "domestic_violence",
    # Catch-all
    "other",
]

# Themes that trigger the safety resource banner in the frontend
CRISIS_THEMES: frozenset[str] = frozenset({
    "self_harm",
    "suicidal_ideation",
    "crisis",
    "substance_abuse",
    "eating_disorder",
    "abuse",
    "domestic_violence",
})

_CLAUDE_MODEL = "claude-sonnet-4-20250514"

_HUMANISE_SYSTEM_PROMPT = (
    "You are an empathetic rewriter. Convert the anonymized thought you receive "
    "into a warm, natural first-person expression between 50 and 60 words. "
    "Preserve the emotional specificity and the core feeling. "
    "Do not add advice, questions, or affirmations. "
    "Output ONLY the rewritten thought — no preamble, no commentary."
)

_CLASSIFY_SYSTEM_PROMPT = (
    "You are an emotional theme classifier. "
    "Given a humanized thought, respond with exactly ONE theme label from this list:\n"
    + "\n".join(f"- {t}" for t in VALID_THEMES)
    + "\n\nRespond with the label only — no explanation, no punctuation, no extra text."
)


# ---------------------------------------------------------------------------
# Custom exception hierarchy
# ---------------------------------------------------------------------------

class ClaudeError(Exception):
    """Base exception for all Claude API errors."""


class ClaudeRateLimitError(ClaudeError):
    """Raised when the Claude API returns a rate-limit (429) response."""


class ClaudeAPIError(ClaudeError):
    """Raised when the Claude API returns any other error response."""


# ---------------------------------------------------------------------------
# Core service functions
# ---------------------------------------------------------------------------

async def humanize_thought(anonymized_text: str) -> str:
    """
    Humanize anonymized thought into natural, empathetic expression.

    Args:
        anonymized_text: Text that has ALREADY been anonymized by the
                        anonymiser service. Must not contain raw PII.

    Returns:
        Humanized text (50-60 words) suitable for display to other users.

    Raises:
        ClaudeRateLimitError: If the Claude API rate limit is exceeded.
        ClaudeAPIError: If the Claude API returns any other error.
        ValueError: If input is empty.

    PRIVACY: This function assumes input has been anonymized. Do NOT pass
    raw user text to this function.
    """
    if not anonymized_text or not anonymized_text.strip():
        raise ValueError("anonymized_text must not be empty.")

    client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)

    try:
        message = await client.messages.create(
            model=_CLAUDE_MODEL,
            max_tokens=200,
            system=_HUMANISE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": anonymized_text.strip()}],
        )
    except anthropic.RateLimitError as exc:
        raise ClaudeRateLimitError(
            "Claude API rate limit exceeded. Please retry later."
        ) from exc
    except anthropic.APIStatusError as exc:
        raise ClaudeAPIError(
            f"Claude API returned an error: {exc.status_code}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise ClaudeAPIError(
            "Could not connect to the Claude API."
        ) from exc
    except anthropic.APIError as exc:
        raise ClaudeAPIError(
            f"Unexpected Claude API error: {exc}"
        ) from exc

    humanized = message.content[0].text.strip() if message.content else ""
    if not humanized:
        raise ClaudeAPIError("Claude returned an empty response for humanization.")

    return humanized


async def classify_theme(humanized_text: str) -> str:
    """
    Classify emotional theme of humanized thought using Claude API.

    Classifies the input into exactly one of the 12 defined theme categories.
    Risk themes (self_harm, suicidal_ideation, crisis, substance_abuse,
    eating_disorder, abuse, domestic_violence) are classified with HIGH RECALL —
    when in doubt, the classifier biases toward risk themes to ensure safety
    resources are shown to users who may need them.

    Calls the Claude API to map the humanized text to one of the predefined
    theme categories. Falls back to "general_anxiety" on any error so that
    theme classification failure is never fatal to the thought pipeline.

    Args:
        humanized_text: Humanized thought text (post anonymisation, post
                        humanisation). Must not be raw user input.

    Returns:
        Theme category string from VALID_THEMES (e.g. "work_stress",
        "relationship_conflict", "self_harm", "general_anxiety", etc.).

    Raises:
        ClaudeRateLimitError: If the Claude API rate limit is exceeded.
        ClaudeAPIError: If the Claude API returns any other error.
        ValueError: If input is empty.

    Note:
        Theme classification is used for:
        - Elasticsearch semantic search grouping
        - Safety resource display (crisis categories trigger safety banner)
        - Future You letter matching
        - Breathing animation co-presence levels

        Falls back to "general_anxiety" if Claude is unavailable.
    """
    if not humanized_text or not humanized_text.strip():
        raise ValueError("humanized_text must not be empty.")

    client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)

    try:
        message = await client.messages.create(
            model=_CLAUDE_MODEL,
            max_tokens=20,
            system=_CLASSIFY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": humanized_text.strip()}],
        )
    except anthropic.RateLimitError as exc:
        raise ClaudeRateLimitError(
            "Claude API rate limit exceeded. Please retry later."
        ) from exc
    except anthropic.APIStatusError as exc:
        raise ClaudeAPIError(
            f"Claude API returned an error: {exc.status_code}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise ClaudeAPIError(
            "Could not connect to the Claude API."
        ) from exc
    except anthropic.APIError as exc:
        raise ClaudeAPIError(
            f"Unexpected Claude API error: {exc}"
        ) from exc

    raw_theme = message.content[0].text.strip().lower() if message.content else ""

    # Normalise and validate — fall back to "other" if unexpected label returned
    theme = raw_theme if raw_theme in VALID_THEMES else "other"
    return theme
