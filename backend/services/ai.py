"""
AI service for humanizing anonymized thoughts.

Uses NanoGPT API (OpenAI-compatible) with Qwen3.5-122B-A10B to convert
anonymized thoughts into natural, empathetic 50-60 word expressions.

CRITICAL: This service MUST ONLY receive anonymized text. It must NEVER
be passed raw user thoughts. The anonymiser service is always called first.

Example:
    Input (anonymized):  "My [male name] at [tech company] undermines me"
    Output (humanized):  "Someone at work consistently undermines me in front
                         of others, and it's eroding my confidence in myself."

Privacy guarantee: The API only ever receives text that has already been
processed by the anonymizer. No raw thoughts, no PII.
"""

import json
import logging
import re

import httpx

from config import config

logger = logging.getLogger(__name__)

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

_NANOGPT_BASE_URL = "https://nano-gpt.com/api/v1"
_MODEL = "qwen3.5-122b-a10b"

_HUMANISE_SYSTEM_PROMPT = (
    "You are an empathetic rewriter. Convert the anonymized thought you receive "
    "into a warm, natural first-person expression between 50 and 60 words. "
    "Replace any bracketed placeholders like [male name], [female name], [company], "
    "[location] with natural generic references (e.g. 'someone', 'a person', "
    "'my workplace', 'where I live'). "
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
# Custom exception hierarchy (names kept for backward compat with router)
# ---------------------------------------------------------------------------

class ClaudeError(Exception):
    """Base exception for all AI API errors."""


class ClaudeRateLimitError(ClaudeError):
    """Raised when the AI API returns a rate-limit (429) response."""


class ClaudeAPIError(ClaudeError):
    """Raised when the AI API returns any other error response."""


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

async def _chat(system_prompt: str, user_content: str, max_tokens: int = 200) -> str:
    """
    Send a chat completion request to the NanoGPT API.

    Returns the assistant message content string.
    Raises ClaudeRateLimitError or ClaudeAPIError on failure.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{_NANOGPT_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.NANOGPT_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": max_tokens,
                    "stream": False,
                },
            )
        except httpx.ConnectError as exc:
            raise ClaudeAPIError("Could not connect to NanoGPT API.") from exc
        except httpx.TimeoutException as exc:
            raise ClaudeAPIError("NanoGPT API request timed out.") from exc
        except httpx.RequestError as exc:
            raise ClaudeAPIError(f"Network error contacting NanoGPT API: {exc}") from exc

    if response.status_code == 429:
        raise ClaudeRateLimitError("NanoGPT API rate limit exceeded. Please retry later.")

    if response.status_code != 200:
        raise ClaudeAPIError(f"NanoGPT API returned HTTP {response.status_code}.")

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        raise ClaudeAPIError("Could not parse NanoGPT API response.") from exc

    if not content:
        raise ClaudeAPIError("NanoGPT API returned an empty response.")

    return content


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
        ClaudeRateLimitError: If the API rate limit is exceeded.
        ClaudeAPIError: If the API returns any other error.
        ValueError: If input is empty.

    PRIVACY: This function assumes input has been anonymized. Do NOT pass
    raw user text to this function.
    """
    if not anonymized_text or not anonymized_text.strip():
        raise ValueError("anonymized_text must not be empty.")

    return await _chat(_HUMANISE_SYSTEM_PROMPT, anonymized_text.strip(), max_tokens=200)


async def classify_theme(humanized_text: str) -> str:
    """
    Classify emotional theme of humanized thought.

    Args:
        humanized_text: Humanized thought text (post anonymisation, post
                        humanisation). Must not be raw user input.

    Returns:
        Theme category string from VALID_THEMES.

    Raises:
        ClaudeRateLimitError: If the API rate limit is exceeded.
        ClaudeAPIError: If the API returns any other error.
        ValueError: If input is empty.
    """
    if not humanized_text or not humanized_text.strip():
        raise ValueError("humanized_text must not be empty.")

    raw_theme = await _chat(_CLASSIFY_SYSTEM_PROMPT, humanized_text.strip(), max_tokens=20)
    theme = raw_theme.lower().strip()
    return theme if theme in VALID_THEMES else "other"


_HUMANISE_AND_CLASSIFY_SYSTEM_PROMPT = (
    "You are an empathetic rewriter and emotional theme classifier. "
    "Given an anonymized thought, do two things:\n"
    "1. Rewrite it as a warm, natural first-person expression between 50 and 60 words. "
    "Replace bracketed placeholders like [male name], [female name], [company], [location] "
    "with natural generic references (e.g. 'someone', 'a person', 'my workplace', 'where I live'). "
    "Preserve the emotional specificity and core feeling. Do not add advice, questions, or affirmations.\n"
    "2. Classify the emotional theme using EXACTLY ONE label from:\n"
    + "\n".join(f"- {t}" for t in VALID_THEMES)
    + "\n\nRespond ONLY with valid JSON — no preamble, no commentary:\n"
    '{"humanised": "<rewritten thought>", "theme": "<theme_label>"}'
)


async def humanize_and_classify(anonymized_text: str) -> tuple[str, str]:
    """
    Humanize and classify an anonymized thought in a single API call.

    Saves one round-trip to NanoGPT compared to calling humanize_thought
    and classify_theme separately.

    Args:
        anonymized_text: Text already processed by the anonymiser service.

    Returns:
        Tuple of (humanised_text, theme_category).

    Raises:
        ClaudeRateLimitError: If the API rate limit is exceeded.
        ClaudeAPIError: If the API returns any other error or unparseable response.
        ValueError: If input is empty.
    """
    if not anonymized_text or not anonymized_text.strip():
        raise ValueError("anonymized_text must not be empty.")

    raw = await _chat(
        _HUMANISE_AND_CLASSIFY_SYSTEM_PROMPT,
        anonymized_text.strip(),
        max_tokens=300,
    )

    match = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            humanised = str(data.get("humanised", "")).strip()
            theme = str(data.get("theme", "other")).lower().strip()
            if humanised:
                return humanised, theme if theme in VALID_THEMES else "other"
        except (json.JSONDecodeError, KeyError):
            pass

    raise ClaudeAPIError("Could not parse combined humanise/classify response from NanoGPT API.")
