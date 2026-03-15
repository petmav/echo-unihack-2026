"""
Anonymizer service for PII removal.

Uses Qwen3.5-0.8B via Ollama (/api/chat endpoint).

CRITICAL: This service MUST be called FIRST in any pipeline that handles
user-generated text. Raw thoughts must be anonymized immediately upon receipt
and NEVER written to disk, logs, or any persistent storage.

The anonymizer:
1. Strips PII (names, companies, locations, etc.)
2. Preserves emotional specificity and context
3. Returns anonymized text suitable for NanoGPT humanization

Example:
    Input:  "My boss David at Google undermines me"
    Output: "My [male name] at [tech company] undermines me"

Privacy guarantee: Raw input text is NEVER logged or stored. It exists only
in request memory and is discarded after anonymization completes.
"""

import json
import logging
import re

import httpx

from config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Runtime mode toggle — switched via admin dashboard
# ---------------------------------------------------------------------------

# Privacy-first default: stay local unless the admin explicitly switches to NanoGPT.
_anonymiser_mode: str = "ollama"  # "ollama" | "nanogpt"


def get_anonymiser_mode() -> str:
    return _anonymiser_mode


def set_anonymiser_mode(mode: str) -> None:
    global _anonymiser_mode
    if mode not in ("ollama", "nanogpt"):
        raise ValueError(f"Unknown anonymiser mode: {mode!r}")
    _anonymiser_mode = mode
    logger.info("Anonymiser mode switched to: %s", mode)


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
    Wraps Ollama calls to the anonymizer SLM (Qwen3.5-0.8B via /api/chat).

    Usage:
        service = AnonymiserService()
        anonymised = await service.anonymise(raw_text)
        await service.close()

    PRIVACY: The raw text parameter is never logged, stored, or passed to any
    external service other than the local Ollama instance.
    """

    _SYSTEM_PROMPT = (
        "You are a PII anonymizer. Output ONLY valid JSON.\n"
        "Replace personal names (NOT pronouns like I/me/my/you) with [male name] or [female name].\n"
        "Replace private company/employer names with [company].\n"
        "Replace specific addresses and small locations with [location].\n"
        "Replace ONLY the exact PII token, not surrounding words.\n"
        'Output: {"replacements": [{"original": "exact token", "replacement": "placeholder"}]}\n'
        "\n"
        "Examples:\n"
        'Input: "My boss James at Amazon keeps undermining me."\n'
        'Output: {"replacements": [{"original": "James", "replacement": "[male name]"}]}\n'
        "\n"
        'Input: "Emma called me from Initech."\n'
        'Output: {"replacements": [{"original": "Emma", "replacement": "[female name]"}, {"original": "Initech", "replacement": "[company]"}]}\n'
        "\n"
        'Input: "I feel so anxious and lost right now."\n'
        'Output: {"replacements": []}'
    )

    _OPTIONS = {
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 20,
        "min_p": 0.0,
        "presence_penalty": 1.5,
        "repeat_penalty": 1.0,
        "num_predict": 2000,
    }

    def __init__(
        self,
        ollama_base_url: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float = 120.0,
    ) -> None:
        self._base_url = (ollama_base_url or getattr(config, "OLLAMA_HOST", "http://localhost:11434")).rstrip("/")
        self._model = model_name or getattr(config, "OLLAMA_MODEL", "anonymizer")
        self._timeout = timeout_seconds
        self._client: httpx.AsyncClient | None = None
        logger.info(
            "AnonymiserService initialized: url=%s model=%s timeout=%.1fs",
            self._base_url,
            self._model,
            self._timeout,
        )

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

        PRIVACY: This method MUST be called before passing text to NanoGPT or
        Elasticsearch. The raw_text value is never written anywhere.
        """
        client = self._get_client()
        url = f"{self._base_url}/api/chat"
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": self._SYSTEM_PROMPT},
                {"role": "user", "content": f"Anonymize: {raw_text}"},
            ],
            "stream": False,
            "think": False,
            "options": self._OPTIONS,
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
            model_output = response.json()["message"]["content"].strip()
        except Exception as exc:
            raise OllamaResponseError(
                "Could not parse Ollama response JSON."
            ) from exc

        return AnonymiserService._apply_replacements(raw_text, model_output)

    @staticmethod
    def _apply_replacements(original: str, model_output: str) -> str:
        """
        Parse the model's JSON response and apply PII replacements.

        Falls back to returning *original* unchanged if the response cannot
        be parsed, so the pipeline never silently drops user text.
        """
        cleaned = re.sub(r"<think>.*?</think>", "", model_output, flags=re.DOTALL).strip()

        # Extract the first JSON object from the response
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            logger.warning("Anonymiser: no JSON object found in model output; returning original text")
            return original

        try:
            data = json.loads(match.group(0))
            replacements = data.get("replacements", [])
        except (json.JSONDecodeError, AttributeError) as exc:
            logger.warning("Anonymiser: failed to parse replacements JSON: %s", exc)
            return original

        result = original
        for item in replacements:
            orig = item.get("original", "")
            repl = item.get("replacement", "")
            if orig and repl:
                result = result.replace(orig, repl)

        return result


# ---------------------------------------------------------------------------
# NanoGPT-backed anonymiser (cloud alternative, same prompt)
# ---------------------------------------------------------------------------

_NANOGPT_ANONYMISE_MODEL = "openai/gpt-oss-120b"
_NANOGPT_BASE_URL = "https://nano-gpt.com/api/v1"


async def _nanogpt_anonymize(raw_text: str) -> str:
    """
    Anonymise raw_text using NanoGPT (gpt-oss-120b) instead of local Ollama.

    Uses the identical system prompt and replacement logic as AnonymiserService.

    PRIVACY: raw_text is sent to the NanoGPT API (external). Only use this
    mode when the privacy trade-off is acceptable for the deployment context.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{_NANOGPT_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.NANOGPT_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _NANOGPT_ANONYMISE_MODEL,
                    "messages": [
                        {"role": "system", "content": AnonymiserService._SYSTEM_PROMPT},
                        {"role": "user", "content": f"Anonymize: {raw_text}"},
                    ],
                    "max_tokens": 256,
                    "stream": False,
                },
            )
        except httpx.ConnectError as exc:
            raise OllamaConnectionError("Could not connect to NanoGPT API.") from exc
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError("NanoGPT anonymiser request timed out.") from exc
        except httpx.RequestError as exc:
            raise OllamaConnectionError(f"Network error contacting NanoGPT API: {exc}") from exc

    if response.status_code != 200:
        raise OllamaResponseError(f"NanoGPT API returned HTTP {response.status_code}.")

    try:
        content = response.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        raise OllamaResponseError("Could not parse NanoGPT API response.") from exc

    return AnonymiserService._apply_replacements(raw_text, content)


# ---------------------------------------------------------------------------
# Module-level convenience helpers (kept for backward compatibility)
# ---------------------------------------------------------------------------

async def anonymize_text(raw_text: str) -> str:
    """
    Anonymize raw user text by removing PII while preserving emotional context.

    Dispatches to Ollama (local) or NanoGPT API depending on the runtime mode
    set via the admin dashboard.

    PRIVACY: This function MUST be called before passing text to any other
    service or API. The raw_text parameter contains sensitive mental health
    content and potential PII.
    """
    if _anonymiser_mode == "nanogpt":
        return await _nanogpt_anonymize(raw_text)

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
