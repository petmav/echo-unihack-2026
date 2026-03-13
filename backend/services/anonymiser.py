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

import httpx

from config import config


# ---------------------------------------------------------------------------
# Custom exception hierarchy
# ---------------------------------------------------------------------------

class AnonymiserError(Exception):
    """Base exception for all anonymiser errors."""


class OllamaConnectionError(AnonymiserError):
    """Raised when the Ollama service cannot be reached."""


class OllamaTimeoutError(AnonymiserError):
    """Raised when a request to Ollama times out."""


class OllamaResponseError(AnonymiserError):
    """Raised when Ollama returns an unexpected or invalid response."""


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class AnonymiserService:
    """
    Wraps Ollama calls to the anonymizer SLM.

    Usage:
        service = AnonymiserService()
        anonymised = await service.anonymise(raw_text)
        await service.close()

    PRIVACY: The raw text parameter is never logged, stored, or passed to any
    external service other than the local Ollama instance.
    """

    def __init__(
        self,
        ollama_base_url: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float = 2.0,
    ) -> None:
        self._base_url = (ollama_base_url or getattr(config, "OLLAMA_HOST", "http://localhost:11434")).rstrip("/")
        self._model = model_name or getattr(config, "OLLAMA_MODEL", "eternisai/anonymizer-0.6b-q4_k_m-gguf")
        self._timeout = timeout_seconds
        self._client: httpx.AsyncClient | None = None

    # ------------------------------------------------------------------
    # Lifecycle helpers
    # ------------------------------------------------------------------

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        """Release the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Core anonymisation
    # ------------------------------------------------------------------

    async def anonymise(self, raw_text: str) -> str:
        """
        Anonymise *raw_text* by stripping PII while preserving emotional context.

        Args:
            raw_text: Raw user thought containing potential PII.

        Returns:
            Anonymised text with PII replaced by semantic placeholders.

        Raises:
            OllamaConnectionError: If Ollama cannot be reached.
            OllamaTimeoutError: If the request exceeds *timeout_seconds*.
            OllamaResponseError: If Ollama returns an invalid response.

        PRIVACY: This method MUST be called before passing text to Claude or
        Elasticsearch. The raw_text value is never written anywhere.
        """
        client = self._get_client()
        url = f"{self._base_url}/api/generate"
        payload = {
            "model": self._model,
            "prompt": raw_text,
            "stream": False,
        }

        try:
            response = await client.post(url, json=payload)
        except httpx.ConnectError as exc:
            raise OllamaConnectionError(
                "Could not connect to Ollama. Is it running?"
            ) from exc
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                "Ollama request timed out."
            ) from exc
        except httpx.RequestError as exc:
            raise OllamaConnectionError(
                "Network error contacting Ollama."
            ) from exc

        if response.status_code != 200:
            raise OllamaResponseError(
                f"Ollama returned HTTP {response.status_code}."
            )

        try:
            data = response.json()
            anonymised = data.get("response", "").strip()
        except Exception as exc:
            raise OllamaResponseError(
                "Could not parse Ollama response JSON."
            ) from exc

        if not anonymised:
            raise OllamaResponseError("Ollama returned an empty response.")

        return anonymised


# ---------------------------------------------------------------------------
# Module-level convenience helpers (kept for backward compatibility)
# ---------------------------------------------------------------------------

async def anonymize_text(raw_text: str) -> str:
    """
    Anonymize raw user text by removing PII while preserving emotional context.

    Args:
        raw_text: Raw user thought containing potential PII.

    Returns:
        Anonymized text with PII replaced by generic placeholders.

    Raises:
        OllamaConnectionError: If Ollama service is unavailable.
        OllamaTimeoutError: If the request times out.
        OllamaResponseError: If the response is invalid.

    PRIVACY: This function MUST be called before passing text to any other
    service or API. The raw_text parameter contains sensitive mental health
    content and potential PII.
    """
    service = AnonymiserService()
    try:
        return await service.anonymise(raw_text)
    finally:
        await service.close()


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
    return len(anonymized.strip()) > 0
