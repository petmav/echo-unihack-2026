"""
Elasticsearch service for thought storage and retrieval.

Manages two indices:
- echo-thoughts: Anonymized/humanized thoughts with theme vectors
- echo-resolutions: "What helped" advice linked to message_ids

PRIVACY ARCHITECTURE:
Elasticsearch documents contain ONLY:
- message_id (UUID, no user linkage)
- humanised_text (post-anonymization, post-Claude)
- theme_category (string)
- sentiment_vector (embeddings for semantic search)
- timestamp_week (week bucket, not exact timestamp)
- has_resolution (boolean)

NO raw thoughts. NO account_id. NO IP addresses. NO device info.

Even if Elasticsearch is breached, attacker gets anonymous humanized thoughts
with no way to link them to users.
"""

from typing import Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from elasticsearch import AsyncElasticsearch

from config import config


# Global Elasticsearch client (initialized on startup)
_es_client: Optional[Any] = None


async def init_elasticsearch() -> None:
    """
    Initialize Elasticsearch client and create indices if needed.

    Called during FastAPI startup event.
    """
    global _es_client
    # TODO: Implement Elasticsearch connection
    # _es_client = AsyncElasticsearch(
    #     cloud_id=config.ELASTIC_CLOUD_ID,
    #     api_key=config.ELASTIC_API_KEY
    # )
    # await ensure_indices_exist()
    pass


async def close_elasticsearch() -> None:
    """
    Close Elasticsearch client connection.

    Called during FastAPI shutdown event.
    """
    global _es_client
    if _es_client:
        await _es_client.close()
        _es_client = None


async def index_thought(
    message_id: str,
    humanised_text: str,
    theme_category: str,
    sentiment_vector: list[float],
) -> bool:
    """
    Index a humanized thought in Elasticsearch.

    Args:
        message_id: Unique UUID for this thought.
        humanised_text: Claude-humanized anonymized text.
        theme_category: Classified emotional theme.
        sentiment_vector: Embedding vector for semantic search.

    Returns:
        True if indexing succeeded.

    PRIVACY: This function ONLY receives anonymized/humanized content.
    No raw thoughts, no user IDs, no account linkage.
    """
    # TODO: Implement Elasticsearch indexing
    # POST to echo-thoughts index with document body
    return True


async def search_similar_thoughts(
    theme_category: str,
    sentiment_vector: list[float],
    limit: int = 20,
    search_after: Optional[list] = None,
) -> dict[str, Any]:
    """
    Search for similar thoughts using vector similarity.

    Args:
        theme_category: Theme to filter by.
        sentiment_vector: Query vector for semantic search.
        limit: Number of results to return.
        search_after: Elasticsearch cursor for pagination.

    Returns:
        Dict containing:
        - thoughts: List of matching thought documents
        - total: Total count of matches
        - search_after: Cursor for next page (None if no more results)

    Note:
        Uses Elasticsearch kNN search with theme filtering.
    """
    # TODO: Implement Elasticsearch vector search
    # Use kNN query with theme_category filter
    return {"thoughts": [], "total": 0, "search_after": None}


async def get_aggregates(theme_category: str) -> int:
    """
    Get weekly aggregate count for a theme category.

    Args:
        theme_category: Theme to count (e.g., "work_stress").

    Returns:
        Number of thoughts in this theme category from the past week.

    Note:
        Used for "Breathing With Others" co-presence visualization.
        Returns anonymous aggregate count with no user linkage.
    """
    # TODO: Implement Elasticsearch aggregation query
    # Count documents in theme_category with timestamp_week = current week
    return 0
