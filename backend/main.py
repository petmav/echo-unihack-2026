"""
Echo Backend - FastAPI Application

Main application entry point for the Echo mental health platform.

PRIVACY ARCHITECTURE:
- Raw thought text is NEVER logged or persisted on the server
- All user thoughts are anonymized immediately upon receipt
- Only anonymized + humanized text reaches Elasticsearch
- No account_id linkage in Elastic documents

This application orchestrates the three-stage AI pipeline:
1. Qwen3.5-0.8B via Ollama (strips PII, preserves emotion)
2. NanoGPT API — qwen3.5-122b-a10b (humanizes anonymized text)
3. Elasticsearch Serverless (semantic matching, zero account linkage)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from config import config
from database import init_db
from middleware.cors import get_cors_middleware
from middleware.logging import get_logging_config, setup_application_logging
from middleware.request_size import add_request_size_middleware
from routers import account, auth, resolution, thoughts
from services.elastic import close_elasticsearch, init_elasticsearch


# Application lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler for startup and shutdown events.

    Startup:
    - Configure application logging
    - Validate configuration
    - Log privacy reminders

    Shutdown:
    - Clean up resources (if any)
    """
    # Startup
    setup_application_logging()
    logger = logging.getLogger("echo")

    logger.info("Echo Backend Starting...")
    logger.info(f"Server: {config.HOST}:{config.PORT}")
    logger.info(f"CORS Origins: {config.CORS_ORIGINS}")
    logger.info(f"Ollama Host: {config.OLLAMA_HOST}")

    # Validate configuration
    missing_config = config.validate()
    if missing_config:
        logger.warning(f"Missing configuration: {', '.join(missing_config)}")
        logger.warning("Some features may not work correctly")
    else:
        logger.info("Configuration validated")

    # Initialize database tables (accounts, message_themes)
    init_db()

    # Initialize Elasticsearch
    await init_elasticsearch()

    yield

    # Shutdown
    logger.info("Echo Backend Shutting Down...")
    await close_elasticsearch()


# Create FastAPI application
app = FastAPI(
    title="Echo API",
    description="Ambient anonymous solidarity through semantic matching",
    version="1.0.0",
    lifespan=lifespan,
)


# Configure CORS middleware
get_cors_middleware(app, config.CORS_ORIGINS)

# Enforce request body size limit (default 10KB)
add_request_size_middleware(app)


# Health check endpoint (no prefix - available at root)
@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint for monitoring and container orchestration.

    Returns:
        {"status": "healthy"}
    """
    return {"status": "healthy"}


# Include all routers with /api/v1 prefix
app.include_router(thoughts.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(resolution.router, prefix="/api/v1")
app.include_router(account.router, prefix="/api/v1")


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """
    Root endpoint - provides API information.

    Returns:
        API metadata and available endpoints
    """
    return {
        "name": "Echo API",
        "version": "1.0.0",
        "description": "Ambient anonymous solidarity through semantic matching",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "thoughts": "/api/v1/thoughts",
            "auth": "/api/v1/auth",
            "resolution": "/api/v1/resolution",
            "account": "/api/v1/account",
        },
    }


# Custom exception handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Custom 404 handler."""
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"},
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """
    Custom 500 handler.

    NOTE: Error details are never included in the response body to avoid
    leaking implementation details. Raw thought text is discarded before
    any exception handling occurs.
    """
    logger = logging.getLogger("echo")
    logger.error("Internal server error (HTTP 500)", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global catch-all exception handler for any unhandled exceptions.

    Logs the exception type and traceback for debugging, but never includes
    exception details in the response body to avoid leaking implementation
    details or any user data.

    NOTE: Raw thought text is discarded before any exception handling occurs,
    so it will never appear in logs triggered from this handler.
    """
    logger = logging.getLogger("echo")
    logger.error(
        "Unhandled exception: %s: %s",
        type(exc).__name__,
        exc.__class__.__qualname__,
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
        log_config=get_logging_config(),
    )
