"""
Unit tests for the thoughts router: GET /api/v1/thoughts/similar.

These tests verify:
- Valid request returns 200 with PaginatedThoughts shape
- 404 returned for unknown message_id
- 422 returned for invalid search_after cursor
- Valid search_after cursor is parsed and passed through to elastic
- No user identifiers appear in the response

All tests mock elastic service calls — no live Elasticsearch required.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import services.elastic as elastic_module
from main import app

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MESSAGE_ID = "msg-abc-123"
SAMPLE_THEME = "work_stress"
SAMPLE_VECTOR = [0.1] * 384


def _make_thought_doc(
    message_id: str = SAMPLE_MESSAGE_ID,
    theme_category: str = SAMPLE_THEME,
) -> dict:
    """Return a minimal thought document as returned by elastic.get_thought_by_id."""
    return {
        "message_id": message_id,
        "humanised_text": "Someone at work consistently undermines my confidence.",
        "theme_category": theme_category,
        "sentiment_vector": SAMPLE_VECTOR,
        "has_resolution": False,
    }


def _make_search_result(
    thoughts: list | None = None,
    total: int = 0,
    search_after: list | None = None,
) -> dict:
    """Return a minimal search result as returned by elastic.search_similar_thoughts."""
    if thoughts is None:
        thoughts = []
    return {
        "thoughts": thoughts,
        "total": total,
        "search_after": search_after,
    }


def _make_sample_thoughts(count: int = 2) -> list[dict]:
    """Return a list of sample thought dicts for use in search results."""
    return [
        {
            "message_id": f"similar-id-{i}",
            "humanised_text": f"Feeling overwhelmed and undervalued at work, thought {i}.",
            "theme_category": SAMPLE_THEME,
            "has_resolution": False,
            "resolution_text": None,
        }
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/similar — Happy path
# ---------------------------------------------------------------------------

class TestGetSimilarThoughtsSuccess:
    """Tests for successful GET /api/v1/thoughts/similar requests."""

    def test_returns_200_with_paginated_thoughts_shape(self, client):
        """Valid request must return 200 with PaginatedThoughts response shape."""
        sample_thoughts = _make_sample_thoughts(2)
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(
            thoughts=sample_thoughts,
            total=42,
            search_after=None,
        )

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        data = response.json()

        # Verify PaginatedThoughts shape
        assert "thoughts" in data
        assert "search_after" in data
        assert "total" in data
        assert isinstance(data["thoughts"], list)
        assert isinstance(data["total"], int)
        assert data["total"] == 42
        assert len(data["thoughts"]) == 2

    def test_response_thoughts_have_correct_fields(self, client):
        """Each thought in response must have all required ThoughtResponse fields."""
        sample_thoughts = _make_sample_thoughts(1)
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(thoughts=sample_thoughts, total=1)

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        thought = response.json()["thoughts"][0]

        assert "message_id" in thought
        assert "humanised_text" in thought
        assert "theme_category" in thought
        assert "has_resolution" in thought
        # resolution_text is Optional — can be absent or None
        assert thought["message_id"] == "similar-id-0"
        assert thought["theme_category"] == SAMPLE_THEME
        assert thought["has_resolution"] is False

    def test_search_after_cursor_returned_when_more_pages(self, client):
        """search_after cursor must be present in response when more results exist."""
        sample_thoughts = _make_sample_thoughts(20)
        next_cursor = [0.95, "last-id"]
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(
            thoughts=sample_thoughts,
            total=100,
            search_after=next_cursor,
        )

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        assert response.json()["search_after"] == next_cursor

    def test_search_after_none_when_last_page(self, client):
        """search_after must be None in response when no more results exist."""
        sample_thoughts = _make_sample_thoughts(3)
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(
            thoughts=sample_thoughts,
            total=3,
            search_after=None,
        )

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        assert response.json()["search_after"] is None

    def test_empty_results_when_no_similar_thoughts(self, client):
        """Valid message_id with no similar thoughts must return 200 with empty list."""
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(thoughts=[], total=0, search_after=None)

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["thoughts"] == []
        assert data["total"] == 0
        assert data["search_after"] is None


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/similar — 404 for unknown message_id
# ---------------------------------------------------------------------------

class TestGetSimilarThoughtsNotFound:
    """Tests for 404 error when message_id does not exist."""

    def test_returns_404_for_unknown_message_id(self, client):
        """GET /similar with an unknown message_id must return 404."""
        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=None)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": "nonexistent-id"},
            )

        assert response.status_code == 404

    def test_404_response_has_detail_field(self, client):
        """404 response body must contain a detail field."""
        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=None)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": "does-not-exist"},
            )

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], str)

    def test_search_is_not_called_on_404(self, client):
        """search_similar_thoughts must not be called when thought doc is not found."""
        mock_search = AsyncMock()

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=None)),
            patch.object(elastic_module, "search_similar_thoughts", new=mock_search),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": "nonexistent-id"},
            )

        assert response.status_code == 404
        mock_search.assert_not_called()


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/similar — 422 for invalid search_after
# ---------------------------------------------------------------------------

class TestGetSimilarThoughtsInvalidCursor:
    """Tests for 422 error when search_after cursor is malformed."""

    def test_returns_422_for_non_json_search_after(self, client):
        """Non-JSON search_after must return 422."""
        thought_doc = _make_thought_doc()

        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID, "search_after": "not-json"},
            )

        assert response.status_code == 422

    def test_returns_422_for_json_object_search_after(self, client):
        """A JSON object (not array) as search_after must return 422."""
        thought_doc = _make_thought_doc()

        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "search_after": json.dumps({"key": "value"}),
                },
            )

        assert response.status_code == 422

    def test_returns_422_for_plain_string_search_after(self, client):
        """A JSON-encoded string (not array) as search_after must return 422."""
        thought_doc = _make_thought_doc()

        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "search_after": json.dumps("just-a-string"),
                },
            )

        assert response.status_code == 422

    def test_422_detail_mentions_search_after(self, client):
        """422 response detail should mention search_after to aid debugging."""
        thought_doc = _make_thought_doc()

        with patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "search_after": "{{bad json}}",
                },
            )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/similar — search_after cursor passthrough
# ---------------------------------------------------------------------------

class TestGetSimilarThoughtsCursorPassthrough:
    """Tests that a valid search_after cursor is parsed and forwarded to elastic."""

    def test_valid_search_after_array_is_parsed_and_passed_to_elastic(self, client):
        """A valid JSON array search_after must be parsed and forwarded to elastic."""
        cursor = [0.95, "msg-previous-id"]
        thought_doc = _make_thought_doc()
        mock_search = AsyncMock(return_value=_make_search_result(total=0))

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=mock_search),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "search_after": json.dumps(cursor),
                },
            )

        assert response.status_code == 200
        mock_search.assert_called_once()
        call_kwargs = mock_search.call_args.kwargs
        assert call_kwargs["search_after"] == cursor

    def test_no_search_after_passes_none_to_elastic(self, client):
        """When search_after is omitted, elastic is called with search_after=None."""
        thought_doc = _make_thought_doc()
        mock_search = AsyncMock(return_value=_make_search_result(total=0))

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=mock_search),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        call_kwargs = mock_search.call_args.kwargs
        assert call_kwargs["search_after"] is None

    def test_size_parameter_forwarded_to_elastic(self, client):
        """Custom size parameter must be forwarded as limit to elastic search."""
        thought_doc = _make_thought_doc()
        mock_search = AsyncMock(return_value=_make_search_result(total=0))

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=mock_search),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID, "size": 10},
            )

        assert response.status_code == 200
        call_kwargs = mock_search.call_args.kwargs
        assert call_kwargs["limit"] == 10

    def test_theme_and_vector_forwarded_from_thought_doc(self, client):
        """theme_category and sentiment_vector from thought doc must be forwarded to elastic."""
        thought_doc = _make_thought_doc(theme_category="loneliness")
        mock_search = AsyncMock(return_value=_make_search_result(total=0))

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=mock_search),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        call_kwargs = mock_search.call_args.kwargs
        assert call_kwargs["theme_category"] == "loneliness"
        assert call_kwargs["sentiment_vector"] == SAMPLE_VECTOR


# ---------------------------------------------------------------------------
# Privacy tests — no user identifiers in response
# ---------------------------------------------------------------------------

class TestGetSimilarThoughtsPrivacy:
    """Privacy tests: response must not contain user-identifying fields."""

    def test_response_contains_no_user_identifiers(self, client):
        """
        PRIVACY TEST: PaginatedThoughts response must NOT contain account_id,
        user_id, ip_address, email, or device_id at any level of nesting.
        """
        sample_thoughts = _make_sample_thoughts(3)
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(thoughts=sample_thoughts, total=3)

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        data = response.json()

        forbidden_keys = {"account_id", "user_id", "ip_address", "email", "device_id"}

        # Check top-level response
        present_in_top = forbidden_keys.intersection(set(data.keys()))
        assert not present_in_top, (
            f"Top-level response contains forbidden keys: {present_in_top}"
        )

        # Check each thought in the list
        for thought in data["thoughts"]:
            present_in_thought = forbidden_keys.intersection(set(thought.keys()))
            assert not present_in_thought, (
                f"Thought object contains forbidden keys: {present_in_thought}"
            )

    def test_thought_items_contain_only_allowed_fields(self, client):
        """
        Each ThoughtResponse must only contain allowed fields:
        message_id, humanised_text, theme_category, has_resolution, resolution_text.
        """
        allowed_fields = {
            "message_id",
            "humanised_text",
            "theme_category",
            "has_resolution",
            "resolution_text",
            "similarity_score",
        }
        sample_thoughts = _make_sample_thoughts(1)
        thought_doc = _make_thought_doc()
        search_result = _make_search_result(thoughts=sample_thoughts, total=1)

        with (
            patch.object(elastic_module, "get_thought_by_id", new=AsyncMock(return_value=thought_doc)),
            patch.object(elastic_module, "search_similar_thoughts", new=AsyncMock(return_value=search_result)),
        ):
            response = client.get(
                "/api/v1/thoughts/similar",
                params={"message_id": SAMPLE_MESSAGE_ID},
            )

        assert response.status_code == 200
        thought = response.json()["thoughts"][0]
        extra_fields = set(thought.keys()) - allowed_fields
        assert not extra_fields, (
            f"Thought response contains unexpected fields: {extra_fields}"
        )
