"""
Pydantic models for the Anonymizer SLM service.

The anonymiser is the first critical step in Echo's privacy pipeline. It uses
Qwen3.5-0.8B (via Ollama) to perform semantic-preserving PII replacement,
stripping identifying information while preserving emotional specificity.

CRITICAL PRIVACY INVARIANT:
Raw thought text must be discarded immediately after anonymisation.
Only the anonymised output should ever be passed to downstream services.
"""

from pydantic import BaseModel, Field, field_validator


class AnonymiseRequest(BaseModel):
    """
    Request schema for anonymisation.

    Contains raw user-generated text that may include PII (names, locations,
    organizations, etc.). This text must NEVER be logged, cached, or stored.
    It exists only in memory for the duration of the anonymisation call.
    """

    text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Raw thought text to anonymise. MUST NOT be logged or stored.",
        examples=[
            "My boss David at Google keeps undermining me in meetings.",
            "Since moving to Brisbane I've felt completely isolated."
        ]
    )

    @field_validator("text")
    @classmethod
    def text_not_empty_whitespace(cls, v: str) -> str:
        """Ensure text is not just whitespace."""
        if not v.strip():
            raise ValueError("Text cannot be empty or whitespace only")
        return v.strip()


class AnonymiseResponse(BaseModel):
    """
    Response schema for anonymisation.

    Contains text with PII replaced by semantic placeholders (e.g., [male name],
    [tech company], [city]). This anonymised text is safe to pass to Claude and
    store in Elasticsearch.

    Examples of transformations:
    - "My boss David" → "My [male name]"
    - "at Google" → "at [tech company]"
    - "in Brisbane" → "in [city]"
    """

    anonymised_text: str = Field(
        ...,
        min_length=1,
        description="Text with PII replaced by semantic placeholders",
        examples=[
            "My [male name] at [tech company] keeps undermining me in meetings.",
            "Since moving to [city] I've felt completely isolated."
        ]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "anonymised_text": "My [male name] at [tech company] keeps undermining me in meetings."
                },
                {
                    "anonymised_text": "Since moving to [city] I've felt completely isolated."
                }
            ]
        }
    }
