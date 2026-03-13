"""
Anonymizer service for PII removal.

Uses Anonymizer SLM 0.6B (eternisai/anonymizer-0.6b-q4_k_m-gguf) via Ollama.

CRITICAL: This service MUST be called FIRST in any pipeline that handles
user-generated text. Raw thoughts must be anonymized immediately upon receipt
and NEVER written to disk, logs, or any persistent storage.

The anonymizer:
1. Strips PII (names, companies, locations, etc.)
2. Preserves emotional specificity and context
3. Returns anonymized text suitable for Claude humanization

Example:
    Input:  "My boss David at Google undermines me"
    Output: "My [male name] at [tech company] undermines me"

Privacy guarantee: Raw input text is NEVER logged or stored. It exists only
in request memory and is discarded after anonymization completes.
"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import httpx

from config import config


async def anonymize_text(raw_text: str) -> str:
    """
    Anonymize raw user text by removing PII while preserving emotional context.

    Args:
        raw_text: Raw user thought containing potential PII.

    Returns:
        Anonymized text with PII replaced by generic placeholders.

    Raises:
        httpx.HTTPError: If Ollama service is unavailable.
        ValueError: If anonymization fails or returns empty text.

    PRIVACY: This function MUST be called before passing text to any other
    service or API. The raw_text parameter contains sensitive mental health
    content and potential PII.
    """
    # TODO: Implement Ollama API call to anonymizer model
    # For now, return the input (stub implementation)
    # Production implementation will call:
    # POST {config.OLLAMA_HOST}/api/generate
    # with model: config.OLLAMA_MODEL
    return raw_text


async def validate_anonymization(original: str, anonymized: str) -> bool:
    """
    Validate that anonymization preserved semantic content.

    Args:
        original: Original raw text (for length/structure comparison only).
        anonymized: Anonymized output text.

    Returns:
        True if anonymization appears successful, False otherwise.

    Note:
        This function does NOT store or log the original text. It performs
        only in-memory validation checks (length ratio, not empty, etc.).
    """
    # TODO: Implement validation logic
    # Check that anonymized text is not empty and has reasonable length
    return len(anonymized.strip()) > 0
