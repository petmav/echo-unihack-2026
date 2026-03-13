"""
Services package for Echo backend.

Contains core service modules:
- anonymiser: Qwen3.5-0.8B integration (Ollama) - ALWAYS called first
- ai: NanoGPT API integration (qwen3.5-122b-a10b) - ONLY receives anonymized text
- elastic: Elasticsearch operations for thought storage/retrieval
- auth: JWT token management and bcrypt password hashing
- embeddings: Sentence embedding service (all-MiniLM-L6-v2, 384-dim)

PRIVACY ARCHITECTURE:
The anonymiser service is the gatekeeper. Raw user text MUST pass through
it before any other processing. NanoGPT and Elastic never see raw thoughts.
"""

from . import ai, anonymiser, auth, elastic, embeddings

__all__ = ["anonymiser", "ai", "elastic", "auth", "embeddings"]
