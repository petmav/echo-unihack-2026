"""
Unit tests for the Elasticsearch service.

These tests verify the privacy architecture and correctness of all
Elasticsearch operations without requiring a live Elasticsearch instance.

Key invariants verified:
- NO account_id, user_id, or IP address in indexed documents
- Correct return shapes for all functions
- Graceful degradation when _es_client is None
- search_after cursor passed through correctly for pagination
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import services.elastic as elastic_module
from services.elastic import (
    index_thought,
    search_similar_thoughts,
    get_aggregates,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MESSAGE_ID = "abc123-uuid-here"
SAMPLE_HUMANISED_TEXT = "Someone at work consistently undermines me."
SAMPLE_THEME = "work_stress"
SAMPLE_VECTOR = [0.1] * 1536  # 1536-dim vector


def _make_mock_es_client() -> AsyncMock:
    """Return a fully mocked AsyncElasticsearch client."""
    client = AsyncMock()
    return client


# ---------------------------------------------------------------------------
# index_thought tests
# ---------------------------------------------------------------------------

class TestIndexThought:
    """Tests for index_thought()."""

    @pytest.mark.asyncio
    async def test_index_thought_returns_true_on_success(self):
        """index_thought should return True when Elasticsearch accepts the document."""
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=SAMPLE_HUMANISED_TEXT,
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_index_thought_document_has_no_account_or_user_id(self):
        """
        PRIVACY TEST: The document indexed in Elasticsearch must NOT contain
        account_id, user_id, ip_address, or any user-identifying fields.
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=SAMPLE_HUMANISED_TEXT,
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        # Extract the document body that was passed to ES
        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        # Privacy invariants
        forbidden_keys = {"account_id", "user_id", "ip_address", "email", "device_id"}
        present_forbidden = forbidden_keys.intersection(set(document.keys()))
        assert not present_forbidden, (
            f"Document contains forbidden user-identifying keys: {present_forbidden}"
        )

    @pytest.mark.asyncio
    async def test_index_thought_document_contains_required_fields(self):
        """The indexed document must contain the required privacy-safe fields."""
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=SAMPLE_HUMANISED_TEXT,
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        assert document["message_id"] == SAMPLE_MESSAGE_ID
        assert document["humanised_text"] == SAMPLE_HUMANISED_TEXT
        assert document["theme_category"] == SAMPLE_THEME
        assert document["sentiment_vector"] == SAMPLE_VECTOR
        assert "timestamp_week" in document
        assert "has_resolution" in document
        assert document["has_resolution"] is False

    @pytest.mark.asyncio
    async def test_index_thought_returns_false_when_client_none(self):
        """index_thought must return False gracefully when _es_client is None."""
        with patch.object(elastic_module, "_es_client", None):
            result = await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=SAMPLE_HUMANISED_TEXT,
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_index_thought_returns_false_on_transport_error(self):
        """index_thought should return False when Elasticsearch raises TransportError."""
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.index.side_effect = TransportError("connection refused")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=SAMPLE_HUMANISED_TEXT,
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        assert result is False


# ---------------------------------------------------------------------------
# search_similar_thoughts tests
# ---------------------------------------------------------------------------

def _make_search_response(hits: list, total: int, last_sort: list | None = None) -> dict:
    """Build a minimal Elasticsearch search response dict."""
    es_hits = []
    for i, thought in enumerate(hits):
        sort_val = [thought.get("_score", 1.0), thought["message_id"]]
        es_hits.append({
            "_source": {
                "message_id": thought["message_id"],
                "humanised_text": thought["humanised_text"],
                "theme_category": thought["theme_category"],
                "has_resolution": thought.get("has_resolution", False),
            },
            "sort": last_sort if (i == len(hits) - 1 and last_sort) else sort_val,
        })
    return {
        "hits": {
            "hits": es_hits,
            "total": {"value": total, "relation": "eq"},
        }
    }


class TestSearchSimilarThoughts:
    """Tests for search_similar_thoughts()."""

    @pytest.mark.asyncio
    async def test_returns_expected_shape(self):
        """search_similar_thoughts must return {thoughts, total, search_after}."""
        sample_thoughts = [
            {
                "message_id": "id-1",
                "humanised_text": "Feeling overwhelmed at work.",
                "theme_category": "work_stress",
                "has_resolution": False,
            }
        ]
        mock_response = _make_search_response(sample_thoughts, total=1)
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=20,
            )

        assert "thoughts" in result
        assert "total" in result
        assert "search_after" in result
        assert isinstance(result["thoughts"], list)
        assert isinstance(result["total"], int)
        assert result["total"] == 1
        assert len(result["thoughts"]) == 1

    @pytest.mark.asyncio
    async def test_thought_items_have_correct_keys(self):
        """Each thought in the result list must have expected keys."""
        sample_thoughts = [
            {
                "message_id": "id-2",
                "humanised_text": "My confidence keeps getting knocked.",
                "theme_category": "work_stress",
                "has_resolution": True,
            }
        ]
        mock_response = _make_search_response(sample_thoughts, total=1)
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=20,
            )

        thought = result["thoughts"][0]
        assert thought["message_id"] == "id-2"
        assert thought["humanised_text"] == "My confidence keeps getting knocked."
        assert thought["theme_category"] == "work_stress"
        assert thought["has_resolution"] is True

    @pytest.mark.asyncio
    async def test_search_after_cursor_passed_through(self):
        """When search_after is provided, it must be included in the ES query body."""
        cursor = [0.95, "id-99"]
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = _make_search_response([], total=0)

        with patch.object(elastic_module, "_es_client", mock_client):
            await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=20,
                search_after=cursor,
            )

        call_kwargs = mock_client.search.call_args.kwargs
        query_body = call_kwargs["body"]
        assert "search_after" in query_body
        assert query_body["search_after"] == cursor

    @pytest.mark.asyncio
    async def test_search_after_not_in_query_when_none(self):
        """When search_after is None, it must NOT appear in the ES query body."""
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = _make_search_response([], total=0)

        with patch.object(elastic_module, "_es_client", mock_client):
            await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=20,
                search_after=None,
            )

        call_kwargs = mock_client.search.call_args.kwargs
        query_body = call_kwargs["body"]
        assert "search_after" not in query_body

    @pytest.mark.asyncio
    async def test_search_after_returned_when_full_page(self):
        """search_after cursor should be returned when a full page of results is present."""
        limit = 2
        thoughts = [
            {"message_id": f"id-{i}", "humanised_text": f"Thought {i}",
             "theme_category": "work_stress"}
            for i in range(limit)
        ]
        next_cursor = [0.9, "id-1"]
        mock_response = _make_search_response(thoughts, total=10, last_sort=next_cursor)
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=limit,
            )

        assert result["search_after"] == next_cursor

    @pytest.mark.asyncio
    async def test_search_after_none_when_partial_page(self):
        """search_after should be None when fewer results than limit are returned."""
        limit = 20
        thoughts = [
            {"message_id": "id-only", "humanised_text": "Only result",
             "theme_category": "work_stress"}
        ]
        mock_response = _make_search_response(thoughts, total=1)
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=limit,
            )

        assert result["search_after"] is None

    @pytest.mark.asyncio
    async def test_returns_empty_when_client_none(self):
        """search_similar_thoughts must return safe empty result when _es_client is None."""
        with patch.object(elastic_module, "_es_client", None):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        assert result == {"thoughts": [], "total": 0, "search_after": None}

    @pytest.mark.asyncio
    async def test_returns_empty_on_transport_error(self):
        """search_similar_thoughts should return empty result on TransportError."""
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.search.side_effect = TransportError("timeout")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await search_similar_thoughts(
                theme_category=SAMPLE_THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        assert result == {"thoughts": [], "total": 0, "search_after": None}


# ---------------------------------------------------------------------------
# get_aggregates tests
# ---------------------------------------------------------------------------

class TestGetAggregates:
    """Tests for get_aggregates()."""

    @pytest.mark.asyncio
    async def test_returns_list_of_theme_count_dicts(self):
        """get_aggregates must return a list of {theme, count} dicts."""
        mock_response = {
            "aggregations": {
                "themes": {
                    "buckets": [
                        {"key": "work_stress", "doc_count": 42},
                        {"key": "relationships", "doc_count": 17},
                        {"key": "self_worth", "doc_count": 8},
                    ]
                }
            }
        }
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_aggregates()

        assert isinstance(result, list)
        assert len(result) == 3

        for item in result:
            assert "theme" in item
            assert "count" in item
            assert isinstance(item["theme"], str)
            assert isinstance(item["count"], int)

    @pytest.mark.asyncio
    async def test_returns_correct_values(self):
        """get_aggregates must map bucket keys and doc_counts correctly."""
        mock_response = {
            "aggregations": {
                "themes": {
                    "buckets": [
                        {"key": "anxiety", "doc_count": 99},
                    ]
                }
            }
        }
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_aggregates()

        assert result == [{"theme": "anxiety", "count": 99}]

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_client_none(self):
        """get_aggregates must return [] gracefully when _es_client is None."""
        with patch.object(elastic_module, "_es_client", None):
            result = await get_aggregates()

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_list_on_error(self):
        """get_aggregates should return [] when Elasticsearch raises an exception."""
        mock_client = _make_mock_es_client()
        mock_client.search.side_effect = Exception("unexpected error")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_aggregates()

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_buckets(self):
        """get_aggregates returns [] when aggregation has no buckets."""
        mock_response = {
            "aggregations": {
                "themes": {
                    "buckets": []
                }
            }
        }
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = mock_response

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_aggregates()

        assert result == []
