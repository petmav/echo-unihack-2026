"""
Configuration module for Echo backend.

Loads environment variables required for the application:
- ANTHROPIC_API_KEY: Claude API access
- ELASTIC_CLOUD_ID: Elasticsearch cloud instance identifier
- ELASTIC_API_KEY: Elasticsearch authentication
- JWT_SECRET: Secret key for JWT token generation
- OLLAMA_HOST: Host URL for local Ollama SLM instance
- DATABASE_URL: PostgreSQL connection string for account data

PRIVACY NOTE: This config module does NOT handle raw thought text.
Raw thoughts are never persisted on the server - they are anonymized
immediately upon receipt and the raw text is discarded.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    # Anthropic Claude API
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Elasticsearch configuration
    ELASTIC_CLOUD_ID: str = os.getenv("ELASTIC_CLOUD_ID", "")
    ELASTIC_API_KEY: str = os.getenv("ELASTIC_API_KEY", "")

    # JWT authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7

    # Ollama SLM for anonymization
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL: str = "hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf"

    # Database configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/echo")

    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Elasticsearch index names
    ELASTIC_THOUGHTS_INDEX: str = "echo-thoughts"
    ELASTIC_RESOLUTIONS_INDEX: str = "echo-resolutions"

    @classmethod
    def validate(cls) -> list[str]:
        """
        Validate that required configuration is present.

        Returns:
            List of missing required configuration keys.
        """
        missing = []

        if not cls.ANTHROPIC_API_KEY:
            missing.append("ANTHROPIC_API_KEY")

        if not cls.ELASTIC_CLOUD_ID:
            missing.append("ELASTIC_CLOUD_ID")

        if not cls.ELASTIC_API_KEY:
            missing.append("ELASTIC_API_KEY")

        if cls.JWT_SECRET == "dev-secret-key-change-in-production":
            missing.append("JWT_SECRET (using default dev key)")

        return missing


# Global config instance
config = Config()
