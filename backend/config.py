"""
Configuration module for Echo backend.

Loads environment variables required for the application:
- NANOGPT_API_KEY: NanoGPT API access (Qwen3.5-122B humanisation)
- ELASTIC_CLOUD_ID: Elasticsearch cloud instance identifier
- ELASTIC_API_KEY: Elasticsearch authentication
- ELASTIC_THOUGHTS_INDEX: Elasticsearch index name for thoughts (default: echo-thoughts)
- ELASTIC_RESOLUTIONS_INDEX: Elasticsearch index name for resolutions (default: echo-resolutions)
- JWT_SECRET: Secret key for JWT token generation
- OLLAMA_HOST: Host URL for local Ollama SLM instance
- DATABASE_URL: PostgreSQL connection string for account data
- RATE_LIMIT_THOUGHTS_PER_HOUR: Max thought submissions per hour per client

PRIVACY NOTE: This config module does NOT handle raw thought text.
Raw thoughts are never persisted on the server - they are anonymized
immediately upon receipt and the raw text is discarded.
"""

from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Application configuration loaded from environment variables via pydantic-settings."""

    # NanoGPT API (OpenAI-compatible, used for humanisation + classification)
    NANOGPT_API_KEY: str = ""

    # Elasticsearch configuration
    # Cloud credentials (optional — falls back to ELASTIC_HOST if not set)
    ELASTIC_CLOUD_ID: str = ""
    ELASTIC_API_KEY: str = ""
    # Local Elasticsearch fallback (used when cloud credentials are absent)
    ELASTIC_HOST: str = "http://localhost:9200"

    # Elasticsearch index names (overridable via env for multi-env deploys)
    ELASTIC_THOUGHTS_INDEX: str = "echo-thoughts"
    ELASTIC_RESOLUTIONS_INDEX: str = "echo-resolutions"

    @property
    def use_elastic_cloud(self) -> bool:
        """True only when cloud credentials look valid (non-empty, non-placeholder)."""
        return bool(
            self.ELASTIC_CLOUD_ID
            and self.ELASTIC_API_KEY
            and not self.ELASTIC_CLOUD_ID.startswith("your-")
            and "..." not in self.ELASTIC_CLOUD_ID
        )

    # JWT authentication
    JWT_SECRET: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7

    # Ollama SLM for anonymization
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3.5:0.8b"

    # Database configuration
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/echo"

    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS configuration (not env-loaded; hardcoded for security)
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.9.165.173:8000",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
        "https://frontend-mauve-one-57.vercel.app",
    ]

    # Admin access — email address that receives the admin flag on login
    ADMIN_EMAIL: str = ""
    # Optional fixed admin password for the web dashboard (generated at startup if empty)
    ADMIN_PASSWORD: str = ""

    # Rate limiting configuration (overridable via env)
    RATE_LIMIT_THOUGHTS_PER_HOUR: int = 10
    RATE_LIMIT_LOGIN_PER_15MIN: int = 5
    RATE_LIMIT_RESOLUTION_PER_HOUR: int = 5

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def validate(self) -> list[str]:
        """
        Validate that required configuration is present.

        Returns:
            List of missing required configuration keys (critical items first).
        """
        import logging

        missing = []

        if not self.NANOGPT_API_KEY:
            missing.append("NANOGPT_API_KEY")

        if self.JWT_SECRET == "dev-secret-key-change-in-production":
            logging.getLogger("echo").error(
                "JWT_SECRET is using the insecure default value. "
                "Set JWT_SECRET in .env before deploying."
            )
            missing.append("JWT_SECRET (INSECURE DEFAULT — set in .env)")

        return missing


# Global config instance
config = Config()
