"""
API Contract Tests — shape-focused tests that verify every endpoint's
response structure matches the documented API contract.

These tests mock all external services so they run without Ollama,
Elasticsearch, or the Claude API.

Coverage:
- GET  /health                         → 200  {status: str}
- GET  /                               → 200  {name, version, endpoints, ...}
- POST /api/v1/thoughts (valid)        → 200  {message_id, theme_category,
                                               match_count, similar_thoughts,
                                               search_after}
- POST /api/v1/thoughts (empty body)   → 422
- POST /api/v1/thoughts (2001-char)    → 422
- GET  /api/v1/thoughts/aggregates     → 200  list[{theme: str, count: int}]
- GET  /api/v1/thoughts/similar
        (missing message_id)           → 422
"""

from fastapi.testclient import TestClient

from main import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_client() -> TestClient:
    """Return a fresh TestClient for the Echo app."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """Contract tests for GET /health."""

    def test_returns_200(self, test_client):
        response = test_client.get("/health")
        assert response.status_code == 200

    def test_response_has_status_key(self, test_client):
        response = test_client.get("/health")
        data = response.json()
        assert "status" in data

    def test_status_value_is_string(self, test_client):
        response = test_client.get("/health")
        data = response.json()
        assert isinstance(data["status"], str)
        assert len(data["status"]) > 0


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------


class TestRootEndpoint:
    """Contract tests for GET /."""

    def test_returns_200(self, test_client):
        response = test_client.get("/")
        assert response.status_code == 200

    def test_response_has_name_key(self, test_client):
        response = test_client.get("/")
        data = response.json()
        assert "name" in data
        assert isinstance(data["name"], str)

    def test_response_has_version_key(self, test_client):
        response = test_client.get("/")
        data = response.json()
        assert "version" in data
        assert isinstance(data["version"], str)

    def test_response_has_endpoints_key(self, test_client):
        response = test_client.get("/")
        data = response.json()
        assert "endpoints" in data
        assert isinstance(data["endpoints"], dict)

    def test_endpoints_dict_is_not_empty(self, test_client):
        response = test_client.get("/")
        data = response.json()
        assert len(data["endpoints"]) > 0


# ---------------------------------------------------------------------------
# POST /api/v1/thoughts — valid request
# ---------------------------------------------------------------------------


class TestSubmitThoughtContract:
    """Contract tests for POST /api/v1/thoughts."""

    def test_valid_body_returns_200(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        assert response.status_code == 200

    def test_response_has_message_id(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert "message_id" in data
        assert isinstance(data["message_id"], str)
        assert len(data["message_id"]) > 0

    def test_response_has_theme_category(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert "theme_category" in data
        assert isinstance(data["theme_category"], str)
        assert len(data["theme_category"]) > 0

    def test_response_has_match_count(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert "match_count" in data
        assert isinstance(data["match_count"], int)
        assert data["match_count"] >= 0

    def test_response_has_similar_thoughts(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert "similar_thoughts" in data
        assert isinstance(data["similar_thoughts"], list)

    def test_response_has_search_after(self, test_client, mock_all_services):
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert "search_after" in data
        # search_after may be null (None) or a list
        assert data["search_after"] is None or isinstance(data["search_after"], list)

    def test_similar_thoughts_items_have_required_fields(
        self, test_client, mock_all_services
    ):
        """Each item in similar_thoughts must expose the documented fields."""
        mock_all_services["search"].return_value = {
            "thoughts": [
                {
                    "message_id": "sim-abc-123",
                    "humanised_text": "Work pressure is relentless.",
                    "theme_category": "work_stress",
                    "has_resolution": False,
                    "resolution_text": None,
                }
            ],
            "total": 1,
            "search_after": None,
        }

        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "I feel overwhelmed by everything at work"},
        )
        data = response.json()
        assert len(data["similar_thoughts"]) == 1

        thought = data["similar_thoughts"][0]
        assert "message_id" in thought
        assert "humanised_text" in thought
        assert "theme_category" in thought
        assert "has_resolution" in thought
        assert "resolution_text" in thought

    def test_search_after_reflects_cursor_from_elastic(
        self, test_client, mock_all_services
    ):
        """search_after in response should match whatever elastic returns."""
        mock_all_services["search"].return_value = {
            "thoughts": [],
            "total": 200,
            "search_after": ["2024-01-01T00:00:00Z", "some-id"],
        }

        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "Feeling really lost lately"},
        )
        data = response.json()
        assert data["search_after"] == ["2024-01-01T00:00:00Z", "some-id"]
        assert data["match_count"] == 200


# ---------------------------------------------------------------------------
# POST /api/v1/thoughts — validation failures
# ---------------------------------------------------------------------------


class TestSubmitThoughtValidation:
    """Contract tests for input validation on POST /api/v1/thoughts."""

    def test_empty_text_returns_422(self, test_client):
        """text with zero length must be rejected by Pydantic validation."""
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": ""},
        )
        assert response.status_code == 422

    def test_text_at_max_length_is_accepted(
        self, test_client, mock_all_services
    ):
        """text of exactly 1000 characters must be accepted."""
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "a" * 1000},
        )
        assert response.status_code == 200

    def test_text_exceeding_max_length_returns_422(self, test_client):
        """text of 1001 characters must be rejected with HTTP 422."""
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": "a" * 1001},
        )
        assert response.status_code == 422

    def test_missing_text_field_returns_422(self, test_client):
        """Omitting text entirely must yield HTTP 422."""
        response = test_client.post(
            "/api/v1/thoughts",
            json={},
        )
        assert response.status_code == 422

    def test_422_response_has_detail_field(self, test_client):
        """422 responses must include a detail key (FastAPI standard)."""
        response = test_client.post(
            "/api/v1/thoughts",
            json={"text": ""},
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/aggregates
# ---------------------------------------------------------------------------


class TestGetAggregatesContract:
    """Contract tests for GET /api/v1/thoughts/aggregates."""

    def test_returns_200(self, test_client, mock_all_services):
        response = test_client.get("/api/v1/thoughts/aggregates")
        assert response.status_code == 200

    def test_response_is_a_list(self, test_client, mock_all_services):
        response = test_client.get("/api/v1/thoughts/aggregates")
        data = response.json()
        assert isinstance(data, list)

    def test_each_item_has_theme_key(self, test_client, mock_all_services):
        mock_all_services["aggregates"].return_value = [
            {"theme": "anxiety", "count": 100},
            {"theme": "loneliness", "count": 50},
        ]
        response = test_client.get("/api/v1/thoughts/aggregates")
        data = response.json()
        assert len(data) > 0
        for item in data:
            assert "theme" in item
            assert isinstance(item["theme"], str)

    def test_each_item_has_count_key(self, test_client, mock_all_services):
        mock_all_services["aggregates"].return_value = [
            {"theme": "anxiety", "count": 100},
            {"theme": "loneliness", "count": 50},
        ]
        response = test_client.get("/api/v1/thoughts/aggregates")
        data = response.json()
        assert len(data) > 0
        for item in data:
            assert "count" in item
            assert isinstance(item["count"], int)

    def test_falls_back_to_demo_data_when_elastic_empty(
        self, test_client, mock_all_services
    ):
        """Endpoint must return non-empty demo data when Elastic returns []."""
        mock_all_services["aggregates"].return_value = []
        response = test_client.get("/api/v1/thoughts/aggregates")
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "theme" in item
            assert "count" in item

    def test_demo_fallback_items_have_positive_counts(
        self, test_client, mock_all_services
    ):
        """Demo fallback data must have positive counts."""
        mock_all_services["aggregates"].return_value = []
        response = test_client.get("/api/v1/thoughts/aggregates")
        data = response.json()
        for item in data:
            assert item["count"] > 0


# ---------------------------------------------------------------------------
# GET /api/v1/thoughts/similar — validation
# ---------------------------------------------------------------------------


class TestGetSimilarThoughtsContract:
    """Contract tests for GET /api/v1/thoughts/similar."""

    def test_missing_message_id_returns_422(self, test_client):
        """message_id is required; omitting it must yield HTTP 422."""
        response = test_client.get("/api/v1/thoughts/similar")
        assert response.status_code == 422

    def test_422_response_has_detail_field(self, test_client):
        """422 response must include FastAPI-standard detail key."""
        response = test_client.get("/api/v1/thoughts/similar")
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
