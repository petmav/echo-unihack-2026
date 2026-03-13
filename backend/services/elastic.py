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

import logging
from datetime import date
from typing import Optional, Any

from elasticsearch import AsyncElasticsearch, TransportError

from config import config


logger = logging.getLogger("echo")

# Global Elasticsearch client (initialized on startup)
_es_client: Optional[AsyncElasticsearch] = None

# Index mapping for echo-thoughts
_THOUGHTS_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "message_id": {"type": "keyword"},
            "humanised_text": {"type": "text"},
            "theme_category": {"type": "keyword"},
            "sentiment_vector": {
                "type": "dense_vector",
                "dims": 1536,
                "index": True,
                "similarity": "cosine",
            },
            "timestamp_week": {"type": "date"},
            "has_resolution": {"type": "boolean"},
        }
    }
}


async def _ensure_indices_exist(client: AsyncElasticsearch) -> None:
    """
    Create Elasticsearch indices with correct mappings if they do not exist.

    Args:
        client: Initialized AsyncElasticsearch client.
    """
    thoughts_index = config.ELASTIC_THOUGHTS_INDEX
    if not await client.indices.exists(index=thoughts_index):
        await client.indices.create(index=thoughts_index, body=_THOUGHTS_INDEX_MAPPING)
        logger.info(f"Created Elasticsearch index: {thoughts_index}")
    else:
        logger.info(f"Elasticsearch index already exists: {thoughts_index}")


async def init_elasticsearch() -> None:
    """
    Initialize Elasticsearch client and create indices if needed.

    Called during FastAPI startup event.
    """
    global _es_client

    _es_client = AsyncElasticsearch(
        cloud_id=config.ELASTIC_CLOUD_ID,
        api_key=config.ELASTIC_API_KEY,
    )

    try:
        await _ensure_indices_exist(_es_client)
        logger.info("Elasticsearch initialized successfully")
    except Exception as exc:
        logger.warning(f"Elasticsearch index setup failed (service may be unavailable): {exc}")


async def close_elasticsearch() -> None:
    """
    Close Elasticsearch client connection.

    Called during FastAPI shutdown event.
    """
    global _es_client
    if _es_client:
        await _es_client.close()
        _es_client = None
        logger.info("Elasticsearch client closed")


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
    if _es_client is None:
        logger.error("Elasticsearch client not initialized")
        return False

    today = date.today()
    timestamp_week = f"{today.isocalendar()[0]}-W{today.isocalendar()[1]:02d}"

    document = {
        "message_id": message_id,
        "humanised_text": humanised_text,
        "theme_category": theme_category,
        "sentiment_vector": sentiment_vector,
        "timestamp_week": timestamp_week,
        "has_resolution": False,
    }

    try:
        await _es_client.index(
            index=config.ELASTIC_THOUGHTS_INDEX,
            id=message_id,
            document=document,
        )
        return True
    except TransportError as exc:
        logger.error(f"Failed to index thought {message_id}: {exc}")
        return False


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
        Sort order: _score desc, message_id asc (tiebreaker for stable pagination).
    """
    if _es_client is None:
        logger.error("Elasticsearch client not initialized")
        return {"thoughts": [], "total": 0, "search_after": None}

    query_body: dict[str, Any] = {
        "knn": {
            "field": "sentiment_vector",
            "query_vector": sentiment_vector,
            "k": limit,
            "num_candidates": limit * 5,
            "filter": {
                "term": {"theme_category": theme_category}
            },
        },
        "sort": [
            {"_score": {"order": "desc"}},
            {"message_id": {"order": "asc"}},
        ],
        "size": limit,
        "_source": ["message_id", "humanised_text", "theme_category", "has_resolution"],
        "track_total_hits": True,
    }

    if search_after is not None:
        query_body["search_after"] = search_after

    try:
        response = await _es_client.search(
            index=config.ELASTIC_THOUGHTS_INDEX,
            body=query_body,
        )

        hits = response["hits"]["hits"]
        total_value = response["hits"]["total"]
        total = total_value["value"] if isinstance(total_value, dict) else int(total_value)

        thoughts = []
        for hit in hits:
            source = hit["_source"]
            thoughts.append({
                "message_id": source["message_id"],
                "humanised_text": source["humanised_text"],
                "theme_category": source["theme_category"],
                "has_resolution": source.get("has_resolution", False),
            })

        next_cursor = hits[-1]["sort"] if hits and len(hits) == limit else None

        return {"thoughts": thoughts, "total": total, "search_after": next_cursor}

    except TransportError as exc:
        logger.error(f"Failed to search similar thoughts for theme {theme_category}: {exc}")
        return {"thoughts": [], "total": 0, "search_after": None}


async def get_aggregates() -> list[dict[str, Any]]:
    """
    Get weekly aggregate counts for all theme categories in the current ISO week.

    Returns:
        List of dicts with keys 'theme' (str) and 'count' (int), one per theme
        that has at least one thought indexed this week. Returns empty list if
        Elasticsearch is unavailable or an error occurs.

    Note:
        Used for "Breathing With Others" co-presence visualization.
        Uses Elasticsearch terms aggregation filtered to current ISO week.
        All counts are anonymous — no user IDs involved.
    """
    if _es_client is None:
        logger.warning("Elasticsearch client not initialized; returning empty aggregates")
        return []

    today = date.today()
    iso = today.isocalendar()
    current_week = f"{iso[0]}-W{iso[1]:02d}"

    query_body: dict[str, Any] = {
        "size": 0,
        "query": {
            "term": {"timestamp_week": current_week}
        },
        "aggs": {
            "themes": {
                "terms": {
                    "field": "theme_category",
                    "size": 100,
                }
            }
        },
    }

    try:
        response = await _es_client.search(
            index=config.ELASTIC_THOUGHTS_INDEX,
            body=query_body,
        )
        buckets = response.get("aggregations", {}).get("themes", {}).get("buckets", [])
        return [{"theme": bucket["key"], "count": bucket["doc_count"]} for bucket in buckets]
    except Exception as exc:
        logger.error(f"Failed to get theme aggregates for week {current_week}: {exc}")
        return []


async def get_thought_by_id(message_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieve a thought document from Elasticsearch by message_id.

    Args:
        message_id: UUID of the thought to retrieve.

    Returns:
        Dict with message_id, humanised_text, theme_category, sentiment_vector,
        and has_resolution if found, or None if not found or unavailable.

    PRIVACY: Returns only anonymized/humanized content. No user IDs.
    """
    if _es_client is None:
        logger.error("Elasticsearch client not initialized")
        return None

    try:
        response = await _es_client.get(
            index=config.ELASTIC_THOUGHTS_INDEX,
            id=message_id,
        )
        source = response["_source"]
        return {
            "message_id": source["message_id"],
            "humanised_text": source["humanised_text"],
            "theme_category": source["theme_category"],
            "sentiment_vector": source["sentiment_vector"],
            "has_resolution": source.get("has_resolution", False),
        }
    except Exception as exc:
        logger.warning(f"Thought {message_id} not found or retrieval failed: {exc}")
        return None


async def get_theme_count(theme_category: str) -> int:
    """
    Get the number of thoughts indexed this ISO week for a specific theme.

    Args:
        theme_category: Theme to count (e.g., "work_stress").

    Returns:
        Count of thoughts in this theme for the current week, or 0 if
        Elasticsearch is unavailable or an error occurs.

    Note:
        Used for "Breathing With Others" co-presence count display.
        Returns anonymous aggregate count with no user linkage.
    """
    if _es_client is None:
        logger.warning("Elasticsearch client not initialized; returning zero theme count")
        return 0

    today = date.today()
    iso = today.isocalendar()
    current_week = f"{iso[0]}-W{iso[1]:02d}"

    query_body: dict[str, Any] = {
        "query": {
            "bool": {
                "filter": [
                    {"term": {"theme_category": theme_category}},
                    {"term": {"timestamp_week": current_week}},
                ]
            }
        }
    }

    try:
        response = await _es_client.count(
            index=config.ELASTIC_THOUGHTS_INDEX,
            body=query_body,
        )
        return int(response.get("count", 0))
    except Exception as exc:
        logger.error(f"Failed to get theme count for {theme_category} week {current_week}: {exc}")
        return 0
