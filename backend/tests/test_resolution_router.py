"""
Tests for GET /api/v1/resolution/{message_id} endpoint.

Verifies:
- 200 response with correct resolution data when found
- 404 response when Elasticsearch returns None
- Response contains correct fields: message_id, resolution_text, resolved_at
- No user identifiers in response
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

import services.elastic as elastic_module
import main as main_module
from main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MESSAGE_ID = "test-uuid-resolution-123"
SAMPLE_RESOLUTION_TEXT = "Taking breaks and talking to a trusted colleague helped me feel heard."
SAMPLE_RESOLVED_AT = 1709900000  # Unix timestamp


def _make_resolution_doc(
    message_id: str = SAMPLE_MESSAGE_ID,
    resolution_text: str = SAMPLE_RESOLUTION_TEXT,
    resolved_at: int = SAMPLE_RESOLVED_AT,
) -> dict:
    """Build a sample resolution document as returned by elastic.get_resolution()."""
    return {
        "message_id": message_id,
        "resolution_text": resolution_text,
        "resolved_at": resolved_at,
    }


# ---------------------------------------------------------------------------
# GET /api/v1/resolution/{message_id} tests
# ---------------------------------------------------------------------------

class TestGetResolution:
    """Tests for GET /api/v1/resolution/{message_id}."""

    def test_returns_200_with_resolution_data_when_found(self):
        """Should return 200 with resolution data when Elasticsearch has a match."""
        resolution_doc = _make_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()
        assert data["message_id"] == SAMPLE_MESSAGE_ID
        assert data["resolution_text"] == SAMPLE_RESOLUTION_TEXT
        assert data["resolved_at"] == SAMPLE_RESOLVED_AT

    def test_returns_404_when_elastic_returns_none(self):
        """Should return 404 when Elasticsearch returns None (no resolution found)."""
        mock_get_resolution = AsyncMock(return_value=None)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 404

    def test_404_response_contains_detail(self):
        """404 response should include a detail message."""
        mock_get_resolution = AsyncMock(return_value=None)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get("/api/v1/resolution/nonexistent-id")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_response_has_correct_fields(self):
        """Response must contain exactly the expected fields: message_id, resolution_text, resolved_at."""
        resolution_doc = _make_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()

        required_fields = {"message_id", "resolution_text", "resolved_at"}
        assert required_fields.issubset(set(data.keys())), (
            f"Response missing required fields. Got: {set(data.keys())}"
        )

    def test_no_user_identifiers_in_response(self):
        """
        PRIVACY TEST: Response must NOT contain account_id, user_id, email,
        ip_address, or any user-identifying fields.
        """
        resolution_doc = _make_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()

        forbidden_keys = {"account_id", "user_id", "email", "ip_address", "device_id"}
        present_forbidden = forbidden_keys.intersection(set(data.keys()))
        assert not present_forbidden, (
            f"Response contains forbidden user-identifying keys: {present_forbidden}"
        )

    def test_message_id_in_response_matches_requested_id(self):
        """message_id in response must match the ID requested in the URL path."""
        target_id = "specific-message-id-abc"
        resolution_doc = _make_resolution_doc(message_id=target_id)
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{target_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["message_id"] == target_id

    def test_resolved_at_is_integer_timestamp(self):
        """resolved_at field must be an integer Unix timestamp."""
        resolution_doc = _make_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["resolved_at"], int)

    def test_elastic_called_with_correct_message_id(self):
        """elastic.get_resolution must be called with the message_id from the URL path."""
        target_id = "check-this-id-xyz"
        resolution_doc = _make_resolution_doc(message_id=target_id)
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                client.get(f"/api/v1/resolution/{target_id}")

        mock_get_resolution.assert_called_once_with(target_id)
