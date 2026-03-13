"""
Logging configuration for Echo backend.

⚠️ CRITICAL PRIVACY REQUIREMENT ⚠️
NEVER log request bodies - raw thoughts transit in the body.

Raw thought text arrives in POST /api/v1/thoughts request bodies and is
discarded immediately after anonymization. Logging request bodies would
violate the core privacy invariant and persist data that must never be stored.

This logging configuration:
- Logs HTTP method, path, status code, response time
- Logs query parameters (safe - no PII)
- Logs response status and errors
- NEVER logs request bodies
- NEVER logs response bodies (may contain sensitive aggregated data)
- NEVER logs IP addresses
"""

import logging
import sys
from typing import Any


def get_logging_config() -> dict[str, Any]:
    """
    Get structured logging configuration for uvicorn.

    Returns:
        Dictionary compatible with uvicorn's logging configuration.

    Usage:
        import uvicorn
        from middleware.logging import get_logging_config

        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            log_config=get_logging_config()
        )

    Privacy Notes:
        - Request bodies are NEVER logged
        - This is enforced by not including body-logging middleware
        - Standard access logs show method + path only
        - Error traces are logged but should not contain raw thought text
          (since it's discarded before any exception handling)
    """
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "access": {
                # NEVER log request bodies - raw thoughts transit in body
                # NEVER log client_addr - IP addresses must not be stored or logged
                "format": '%(asctime)s - %(levelname)s - "%(request_line)s" %(status_code)s',
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": "INFO",
                "propagate": False,
            },
            "fastapi": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
        },
        "root": {
            "level": "INFO",
            "handlers": ["default"],
        },
    }


def setup_application_logging() -> None:
    """
    Configure application-level logging for Echo services.

    Call this during application startup to ensure consistent logging
    across all service modules (anonymiser, ai, elastic, auth).

    Privacy Notes:
        - Service logs should log operations but NEVER raw input text
        - Each service module has explicit warnings in docstrings
        - Anonymiser service especially: NEVER log the input text parameter
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Set library log levels to reduce noise
    logging.getLogger("elasticsearch").setLevel(logging.WARNING)
    # anthropic SDK removed — NanoGPT calls go through httpx (already silenced below)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    # Application logger
    logger = logging.getLogger("echo")
    logger.setLevel(logging.INFO)

    # Log privacy reminder on startup
    logger.info("=" * 80)
    logger.info("PRIVACY REMINDER: Request bodies are NEVER logged")
    logger.info("Raw thought text transits in POST bodies and must not be persisted")
    logger.info("=" * 80)
