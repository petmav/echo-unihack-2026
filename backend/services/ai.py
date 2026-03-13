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

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import anthropic

from config import config


async def humanize_thought(anonymized_text: str) -> str:
    """
    Humanize anonymized thought into natural, empathetic expression.

    Args:
        anonymized_text: Text that has ALREADY been anonymized by the
                        anonymiser service. Must not contain raw PII.

    Returns:
        Humanized text (50-60 words) suitable for display to other users.

    Raises:
        anthropic.APIError: If Claude API call fails.
        ValueError: If input is empty or output is malformed.

    PRIVACY: This function assumes input has been anonymized. Do NOT pass
    raw user text to this function.
    """
    # TODO: Implement Claude API call
    # For now, return the input (stub implementation)
    # Production implementation will call:
    # anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    # with prompt instructing 50-60 word empathetic humanization
    return anonymized_text


async def classify_theme(humanized_text: str) -> str:
    """
    Classify emotional theme of humanized thought.

    Args:
        humanized_text: Humanized thought text.

    Returns:
        Theme category string (e.g., "work_stress", "relationship_conflict",
        "self_harm", "anxiety", etc.).

    Note:
        Theme classification is used for:
        - Elasticsearch semantic search
        - Safety resource display (crisis categories)
        - Future You letter matching
        - Breathing animation co-presence levels
    """
    # TODO: Implement theme classification
    # Options: Claude API, or simple keyword matching, or embedding similarity
    # For now, return a default theme (stub implementation)
    return "general_anxiety"
