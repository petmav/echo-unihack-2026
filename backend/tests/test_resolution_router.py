"""
Tests for GET /api/v1/resolution/{message_id} endpoint.

Verifies:
- 200 response with correct resolution data when found
- 404 response when Elasticsearch returns None
- Response contains correct fields: message_id, resolution_text
- No user identifiers in response

Note: The router maps elastic.get_resolution()'s 'anonymised_text' key
to 'resolution_text' in the HTTP response. No 'resolved_at' field is
returned by this endpoint.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import main as main_module
import services.elastic as elastic_module
from main import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MESSAGE_ID = "test-uuid-resolution-123"
SAMPLE_RESOLUTION_TEXT = "Taking breaks and talking to a trusted colleague helped me feel heard."


def _make_elastic_resolution_doc(
    message_id: str = SAMPLE_MESSAGE_ID,
    anonymised_text: str = SAMPLE_RESOLUTION_TEXT,
) -> dict:
    """Build a sample resolution document as returned by elastic.get_resolution()."""
    return {
        "message_id": message_id,
        "anonymised_text": anonymised_text,
    }


# ---------------------------------------------------------------------------
# GET /api/v1/resolution/{message_id} tests
# ---------------------------------------------------------------------------

class TestGetResolution:
    """Tests for GET /api/v1/resolution/{message_id}."""

    def test_returns_200_with_resolution_data_when_found(self):
        """Should return 200 with resolution data when Elasticsearch has a match."""
        resolution_doc = _make_elastic_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
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

    def test_returns_404_when_elastic_returns_none(self):
        """Should return 404 when Elasticsearch returns None (no resolution found)."""
        mock_get_resolution = AsyncMock(return_value=None)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
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
            patch.object(main_module, "init_db", new_callable=MagicMock),
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
        """Response must contain message_id and resolution_text (no resolved_at)."""
        resolution_doc = _make_elastic_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()

        required_fields = {"message_id", "resolution_text"}
        assert required_fields.issubset(set(data.keys())), (
            f"Response missing required fields. Got: {set(data.keys())}"
        )

    def test_no_user_identifiers_in_response(self):
        """
        PRIVACY TEST: Response must NOT contain account_id, user_id, email,
        ip_address, or any user-identifying fields.
        """
        resolution_doc = _make_elastic_resolution_doc()
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
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
        resolution_doc = _make_elastic_resolution_doc(message_id=target_id)
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{target_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["message_id"] == target_id

    def test_resolution_text_is_mapped_from_anonymised_text(self):
        """
        The router maps elastic's 'anonymised_text' to 'resolution_text' in
        the HTTP response. Verify this mapping is applied correctly.
        """
        stored_anonymised = "I spoke to [job title] at [company] and it helped."
        resolution_doc = _make_elastic_resolution_doc(anonymised_text=stored_anonymised)
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                response = client.get(f"/api/v1/resolution/{SAMPLE_MESSAGE_ID}")

        assert response.status_code == 200
        data = response.json()
        # The response key is 'resolution_text', mapped from 'anonymised_text'
        assert data["resolution_text"] == stored_anonymised

    def test_elastic_called_with_correct_message_id(self):
        """elastic.get_resolution must be called with the message_id from the URL path."""
        target_id = "check-this-id-xyz"
        resolution_doc = _make_elastic_resolution_doc(message_id=target_id)
        mock_get_resolution = AsyncMock(return_value=resolution_doc)

        with (
            patch.object(main_module, "init_db", new_callable=MagicMock),
            patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
            patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
            patch.object(elastic_module, "get_resolution", mock_get_resolution),
        ):
            with TestClient(app) as client:
                client.get(f"/api/v1/resolution/{target_id}")

        mock_get_resolution.assert_called_once_with(target_id)
