"""
HTTP-level tests for GET /api/v1/thoughts/aggregates.

These tests verify the router behaviour at the HTTP boundary using FastAPI's
TestClient. They mock services.elastic.get_aggregates so no live Elasticsearch
instance is required.

Cases covered:
1. Endpoint returns HTTP 200
2. Response body is a list with correct item shape
3. Demo data is returned when Elasticsearch is unavailable (returns [])
4. Live Elasticsearch data is returned when get_aggregates returns results
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import routers.thoughts as thoughts_router
import services.elastic as elastic_module
from main import app

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DEMO_AGGREGATES = thoughts_router._DEMO_AGGREGATES


def _assert_list_shape(data: list) -> None:
    """Assert each item exposes the documented aggregate keys."""
    assert isinstance(data, list)
    for item in data:
        assert "theme" in item, f"Missing 'theme' key in item: {item}"
        assert "count" in item, f"Missing 'count' key in item: {item}"
        assert "resolution_count" in item, f"Missing 'resolution_count' key in item: {item}"
        assert "resolution_rate" in item, f"Missing 'resolution_rate' key in item: {item}"
        assert isinstance(item["theme"], str), "'theme' must be a string"
        assert isinstance(item["count"], int), "'count' must be an int"
        assert isinstance(item["resolution_count"], int), "'resolution_count' must be an int"
        assert isinstance(item["resolution_rate"], int), "'resolution_rate' must be an int"


# ---------------------------------------------------------------------------
# Tests: GET /api/v1/thoughts/aggregates
# ---------------------------------------------------------------------------

class TestGetThemeAggregates:
    """HTTP-level tests for GET /api/v1/thoughts/aggregates."""

    def test_returns_200(self, client):
        """Endpoint must return HTTP 200 in all normal scenarios."""
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=[])):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200

    def test_returns_list_shape(self, client):
        """Response body must be a JSON array with aggregate objects."""
        live_data = [
            {
                "theme": "work_stress",
                "count": 127,
                "resolution_count": 31,
                "resolution_rate": 24,
            },
            {
                "theme": "anxiety",
                "count": 84,
                "resolution_count": 18,
                "resolution_rate": 21,
            },
        ]
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=live_data)):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        data = response.json()
        _assert_list_shape(data)

    def test_returns_demo_data_when_elastic_unavailable(self, client):
        """
        When Elasticsearch is unavailable (get_aggregates returns []),
        the endpoint must fall back to the built-in demo data.
        """
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=[])):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        data = response.json()

        # Must have content (demo data is non-empty)
        assert len(data) > 0, "Demo data fallback must return non-empty list"

        # Shape must be correct
        _assert_list_shape(data)

        # Content must match the expected demo aggregates
        demo_themes = {item["theme"] for item in _DEMO_AGGREGATES}
        returned_themes = {item["theme"] for item in data}
        assert returned_themes == demo_themes, (
            f"Demo data themes mismatch.\nExpected: {demo_themes}\nGot: {returned_themes}"
        )

    def test_returns_live_data_when_elastic_returns_results(self, client):
        """
        When Elasticsearch returns aggregate results, the endpoint must
        return those results rather than the demo data.
        """
        live_data = [
            {
                "theme": "loneliness",
                "count": 512,
                "resolution_count": 97,
                "resolution_rate": 19,
            },
            {
                "theme": "self_worth",
                "count": 301,
                "resolution_count": 72,
                "resolution_rate": 24,
            },
            {
                "theme": "grief",
                "count": 88,
                "resolution_count": 15,
                "resolution_rate": 17,
            },
        ]
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=live_data)):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        data = response.json()

        assert len(data) == len(live_data)
        _assert_list_shape(data)

        # Values must match exactly what Elasticsearch returned
        assert data == live_data, (
            f"Live data mismatch.\nExpected: {live_data}\nGot: {data}"
        )

    def test_live_data_takes_precedence_over_demo_data(self, client):
        """
        Live Elasticsearch data (when non-empty) must be returned instead of
        demo data, even if live data has fewer entries.
        """
        single_result = [
            {
                "theme": "anxiety",
                "count": 1,
                "resolution_count": 0,
                "resolution_rate": 0,
            }
        ]
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=single_result)):
            response = client.get("/api/v1/thoughts/aggregates")

        data = response.json()

        # Should return the single live entry, NOT the 10-item demo set
        assert data == single_result

    def test_response_has_cache_control_header(self, client):
        """
        Endpoint must set Cache-Control header for CDN/browser caching.
        """
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=[])):
            response = client.get("/api/v1/thoughts/aggregates")

        assert "cache-control" in response.headers
        cache_control = response.headers["cache-control"]
        assert "max-age" in cache_control

    def test_demo_data_items_have_positive_counts(self, client):
        """All demo aggregate counts must be positive integers."""
        with patch.object(elastic_module, "get_aggregates", new=AsyncMock(return_value=[])):
            response = client.get("/api/v1/thoughts/aggregates")

        data = response.json()
        for item in data:
            assert item["count"] > 0, (
                f"Demo count for theme '{item['theme']}' must be positive, got {item['count']}"
            )
            assert item["resolution_count"] >= 0
            assert 0 <= item["resolution_rate"] <= 100
