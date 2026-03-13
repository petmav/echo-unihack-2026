"""
Middleware components for Echo backend.

CORS middleware:
- Configured to allow requests from frontend (localhost:3000)
- Essential for local development and demo

Logging middleware:
- Structured logging for debugging and monitoring
- CRITICAL PRIVACY CONSTRAINT: NEVER logs request bodies
- Raw thought text transits in request bodies and must not be persisted

PRIVACY INVARIANT: Request body logging is explicitly disabled.
Raw thoughts arrive in POST bodies and are discarded after anonymization.
Logging request bodies anywhere would violate the core privacy model.
"""

from .cors import get_cors_middleware
from .logging import get_logging_config

__all__ = [
    "get_cors_middleware",
    "get_logging_config",
]
