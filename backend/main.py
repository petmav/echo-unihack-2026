"""
Echo Backend - FastAPI Application

Main application entry point for the Echo mental health platform.

PRIVACY ARCHITECTURE:
- Raw thought text is NEVER logged or persisted on the server
- All user thoughts are anonymized immediately upon receipt
- Only anonymized + humanized text reaches Elasticsearch
- No account_id linkage in Elastic documents

This application orchestrates the three-stage AI pipeline:
1. Anonymizer SLM 0.6B (strips PII, preserves emotion)
2. Claude API (humanizes anonymized text)
3. Elasticsearch (semantic matching, zero account linkage)
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from config import config
from middleware.cors import get_cors_middleware
from middleware.logging import setup_application_logging
from routers import thoughts, auth, resolution, account


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

    logger.info("🌊 Echo Backend Starting...")
    logger.info(f"Server: {config.HOST}:{config.PORT}")
    logger.info(f"CORS Origins: {config.CORS_ORIGINS}")
    logger.info(f"Ollama Host: {config.OLLAMA_HOST}")

    # Validate configuration
    missing_config = config.validate()
    if missing_config:
        logger.warning(f"⚠️  Missing configuration: {', '.join(missing_config)}")
        logger.warning("Some features may not work correctly")
    else:
        logger.info("✓ Configuration validated")

    yield

    # Shutdown
    logger.info("🌊 Echo Backend Shutting Down...")


# Create FastAPI application
app = FastAPI(
    title="Echo API",
    description="Ambient anonymous solidarity through semantic matching",
    version="1.0.0",
    lifespan=lifespan,
)


# Configure CORS middleware
get_cors_middleware(app, config.CORS_ORIGINS)


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

    NOTE: Error messages should never contain raw thought text since it's
    discarded before any exception handling occurs.
    """
    logger = logging.getLogger("echo")
    logger.error(f"Internal server error: {exc}", exc_info=True)

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
        log_config=None,  # We use our custom logging setup
    )
