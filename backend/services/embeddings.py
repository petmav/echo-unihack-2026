"""
Sentence embedding service for semantic similarity search.

Uses all-MiniLM-L6-v2 (384-dim) via sentence-transformers.
Model is loaded lazily as a module-level singleton on first call.

PRIVACY: This service only ever receives post-anonymisation, post-humanisation
text. Raw thought text must never be passed here.
"""

import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer

_MODEL_NAME = "all-MiniLM-L6-v2"
_DIMS = 384


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(_MODEL_NAME)


async def embed(text: str) -> list[float]:
    """
    Embed text into a 384-dim unit-normalised vector.

    Runs the CPU-bound encode() in a thread pool to avoid blocking the
    asyncio event loop.

    Args:
        text: Anonymised/humanised thought text. Must NOT be raw user input.

    Returns:
        List of 384 floats (unit-normalised, suitable for cosine similarity).
    """
    loop = asyncio.get_event_loop()
    model = _get_model()
    vector = await loop.run_in_executor(
        None,
        lambda: model.encode(text, normalize_embeddings=True).tolist()
    )
    return vector
