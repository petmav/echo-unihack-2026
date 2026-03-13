"""
Services package for Echo backend.

Contains core service modules:
- anonymiser: Anonymizer SLM 0.6B integration (Ollama) - ALWAYS called first
- ai: Claude API integration - ONLY receives anonymized text
- elastic: Elasticsearch operations for thought storage/retrieval
- auth: JWT token management and bcrypt password hashing

PRIVACY ARCHITECTURE:
The anonymiser service is the gatekeeper. Raw user text MUST pass through
it before any other processing. Claude and Elastic never see raw thoughts.
"""

from . import anonymiser
from . import ai
from . import elastic
from . import auth

__all__ = ["anonymiser", "ai", "elastic", "auth"]
