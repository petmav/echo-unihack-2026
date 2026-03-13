"""
CORS middleware configuration for Echo backend.

Allows requests from the frontend development server (localhost:3000)
with appropriate credentials and headers for authenticated requests.
"""

from typing import TYPE_CHECKING

from fastapi.middleware.cors import CORSMiddleware

if TYPE_CHECKING:
    from fastapi import FastAPI


def get_cors_middleware(app: "FastAPI", allowed_origins: list[str]) -> None:
    """
    Configure CORS middleware for the FastAPI application.

    Args:
        app: FastAPI application instance
        allowed_origins: List of allowed origin URLs (e.g., ["http://localhost:3000"])

    Configuration:
        - Allows credentials (for JWT auth cookies/headers)
        - Allows all standard HTTP methods
        - Allows common headers including Authorization
        - Exposes standard response headers

    Usage:
        from config import config
        get_cors_middleware(app, config.CORS_ORIGINS)
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "Accept",
            "Origin",
            "User-Agent",
            "DNT",
            "Cache-Control",
            "X-Requested-With",
        ],
        expose_headers=["Content-Length", "Content-Type"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )
