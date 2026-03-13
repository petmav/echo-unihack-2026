"""
Unit tests for the Elasticsearch resolution service functions.

These tests verify the privacy architecture and correctness of
store_resolution() and get_resolution() without requiring a live
Elasticsearch instance.

Key invariants verified:
- NO account_id, user_id, or IP address in indexed documents
- Correct return values (True/False for store, dict/None for get)
- Graceful degradation when _es_client is None
- Correct handling of 404 / not-found scenarios
- TransportError handled without raising
"""

from unittest.mock import AsyncMock, patch

import pytest

import services.elastic as elastic_module
from services.elastic import (
    get_resolution,
    store_resolution,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_MESSAGE_ID = "res-uuid-001"
SAMPLE_RESOLUTION_TEXT = "Taking regular breaks and talking to my manager really helped."


def _make_mock_es_client() -> AsyncMock:
    """Return a fully mocked AsyncElasticsearch client."""
    client = AsyncMock()
    return client


# ---------------------------------------------------------------------------
# store_resolution tests
# ---------------------------------------------------------------------------


class TestStoreResolution:
    """Tests for store_resolution()."""

    @pytest.mark.asyncio
    async def test_returns_true_on_success(self):
        """store_resolution should return True when both ES operations succeed."""
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}
        mock_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_client_none(self):
        """store_resolution must return False gracefully when _es_client is None."""
        with patch.object(elastic_module, "_es_client", None):
            result = await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_on_transport_error_indexing(self):
        """store_resolution should return False when ES raises TransportError on index."""
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.index.side_effect = TransportError("connection refused")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_if_update_thought_flag_fails(self):
        """
        store_resolution returns False if updating has_resolution on the thought
        raises a TransportError, because both operations are in the same try block.
        """
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}
        mock_client.update.side_effect = TransportError("update failed")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_document_has_no_user_identifying_fields(self):
        """
        PRIVACY TEST: The resolution document indexed in Elasticsearch must NOT
        contain account_id, user_id, ip_address, email, or device_id.
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}
        mock_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        forbidden_keys = {"account_id", "user_id", "ip_address", "email", "device_id"}
        present_forbidden = forbidden_keys.intersection(set(document.keys()))
        assert not present_forbidden, (
            f"Resolution document contains forbidden user-identifying keys: {present_forbidden}"
        )

    @pytest.mark.asyncio
    async def test_document_contains_required_fields(self):
        """
        The resolution document must contain message_id, anonymised_text,
        and submitted_at (ISO date string).
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}
        mock_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        assert document["message_id"] == SAMPLE_MESSAGE_ID
        assert document["anonymised_text"] == SAMPLE_RESOLUTION_TEXT
        assert "submitted_at" in document
        # submitted_at is an ISO date string (e.g. "2026-03-09")
        assert isinstance(document["submitted_at"], str)

    @pytest.mark.asyncio
    async def test_updates_has_resolution_flag_on_thought(self):
        """store_resolution must call update on the thoughts index to mark has_resolution=True."""
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}
        mock_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=SAMPLE_RESOLUTION_TEXT,
            )

        mock_client.update.assert_called_once()
        update_kwargs = mock_client.update.call_args.kwargs
        assert update_kwargs["id"] == SAMPLE_MESSAGE_ID
        assert update_kwargs["doc"] == {"has_resolution": True}


# ---------------------------------------------------------------------------
# get_resolution tests
# ---------------------------------------------------------------------------


class TestGetResolution:
    """Tests for get_resolution()."""

    @pytest.mark.asyncio
    async def test_returns_dict_with_correct_keys_when_found(self):
        """
        get_resolution uses ES search and should return a dict with
        message_id and anonymised_text when a resolution is found.
        """
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "message_id": SAMPLE_MESSAGE_ID,
                            "anonymised_text": SAMPLE_RESOLUTION_TEXT,
                        }
                    }
                ],
                "total": {"value": 1, "relation": "eq"},
            }
        }

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is not None
        assert result["message_id"] == SAMPLE_MESSAGE_ID
        assert result["anonymised_text"] == SAMPLE_RESOLUTION_TEXT

    @pytest.mark.asyncio
    async def test_returns_none_when_client_none(self):
        """get_resolution must return None gracefully when _es_client is None."""
        with patch.object(elastic_module, "_es_client", None):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        """get_resolution should return None when search returns no hits."""
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = {
            "hits": {
                "hits": [],
                "total": {"value": 0, "relation": "eq"},
            }
        }

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        """get_resolution should return None when Elasticsearch raises an exception."""
        mock_client = _make_mock_es_client()
        mock_client.search.side_effect = Exception("404: document missing")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_transport_error(self):
        """get_resolution should return None on TransportError."""
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.search.side_effect = TransportError("timeout")

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_result_contains_no_user_identifying_fields(self):
        """
        PRIVACY TEST: The returned resolution dict must NOT contain account_id,
        user_id, ip_address, email, or device_id.
        """
        mock_client = _make_mock_es_client()
        mock_client.search.return_value = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "message_id": SAMPLE_MESSAGE_ID,
                            "anonymised_text": SAMPLE_RESOLUTION_TEXT,
                        }
                    }
                ],
                "total": {"value": 1, "relation": "eq"},
            }
        }

        with patch.object(elastic_module, "_es_client", mock_client):
            result = await get_resolution(message_id=SAMPLE_MESSAGE_ID)

        assert result is not None
        forbidden_keys = {"account_id", "user_id", "ip_address", "email", "device_id"}
        present_forbidden = forbidden_keys.intersection(set(result.keys()))
        assert not present_forbidden, (
            f"Resolution result contains forbidden user-identifying keys: {present_forbidden}"
        )
