"""
Request size limit middleware for Echo backend.

Enforces a maximum request body size to prevent abuse via very large payloads
that could bypass Pydantic field-level validation or exhaust server resources.

Default limit is 10KB (10,240 bytes), configurable at instantiation.

Privacy Note:
    This middleware reads Content-Length headers only. It does NOT read, log,
    or inspect request body content. Raw thought text in POST bodies remains
    unread if the declared size exceeds the limit.
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger("echo")

DEFAULT_MAX_SIZE_BYTES = 10 * 1024  # 10KB


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that rejects requests whose Content-Length exceeds a configured
    maximum body size.

    Requests without a Content-Length header are allowed through; body size
    enforcement for chunked transfers is left to Pydantic field limits.

    Args:
        app: The ASGI application to wrap.
        max_size_bytes: Maximum allowed Content-Length in bytes.
                        Defaults to 10,240 (10KB).

    Usage:
        from middleware.request_size import RequestSizeLimitMiddleware

        app.add_middleware(RequestSizeLimitMiddleware, max_size_bytes=10_240)

    Responses:
        413 Request Entity Too Large — when Content-Length exceeds the limit.
    """

    def __init__(self, app, max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES) -> None:
        super().__init__(app)
        self.max_size_bytes = max_size_bytes

    async def dispatch(self, request: Request, call_next):
        """
        Check Content-Length before forwarding to the application.

        Does NOT read or log the body — only inspects the Content-Length header.
        """
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                size = int(content_length)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header"},
                )

            if size > self.max_size_bytes:
                logger.warning(
                    "Request rejected: Content-Length %d exceeds limit of %d bytes "
                    "(path=%s, method=%s)",
                    size,
                    self.max_size_bytes,
                    request.url.path,
                    request.method,
                )
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": (
                            f"Request body too large. "
                            f"Maximum allowed size is {self.max_size_bytes} bytes."
                        )
                    },
                )

        return await call_next(request)


def add_request_size_middleware(
    app: "FastAPI", max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES
) -> None:
    """
    Register RequestSizeLimitMiddleware on a FastAPI application.

    Args:
        app: FastAPI application instance.
        max_size_bytes: Maximum allowed Content-Length in bytes.
                        Defaults to 10,240 (10KB).

    Usage:
        from middleware.request_size import add_request_size_middleware
        add_request_size_middleware(app, max_size_bytes=10_240)
    """
    app.add_middleware(RequestSizeLimitMiddleware, max_size_bytes=max_size_bytes)
