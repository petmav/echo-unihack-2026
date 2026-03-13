"""
Privacy invariants test suite.

Verifies the core privacy guarantees of the Echo platform:
1. Raw thought text NEVER appears in Elasticsearch documents
2. Raw thought text NEVER appears in log output
3. Raw thought text NEVER appears in error responses
4. Forbidden fields (account_id, user_id, ip_address) are absent from ES documents
5. Resolution text follows the same privacy guarantees

These are the most critical tests in the codebase — a failure here is a
privacy violation, not merely a functional bug.
"""

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import services.elastic as elastic_module
from main import app
from services.anonymiser import OllamaConnectionError, OllamaResponseError, OllamaTimeoutError
from services.elastic import index_thought, store_resolution

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Raw thought text containing PII — must NEVER reach Elasticsearch or logs
RAW_THOUGHT_PII = "My boss David Keller at Goldman Sachs undermines me every meeting"
RAW_THOUGHT_KEYWORDS = ["David", "Keller", "Goldman", "Sachs"]

RAW_RESOLUTION_PII = "I spoke to Dr. Emily Watson at St. Vincent's Hospital and it helped"
RAW_RESOLUTION_KEYWORDS = ["Emily", "Watson", "Vincent"]

# Safe post-anonymisation text
ANONYMISED_TEXT = "My [male name] at [financial company] undermines me every meeting"
HUMANISED_TEXT = "Someone at work consistently undermines my contributions, eroding my confidence."
THEME = "work_stress"
SAMPLE_VECTOR = [0.1] * 384
SAMPLE_MESSAGE_ID = "test-uuid-privacy-1234"

# Forbidden fields must never appear in any Elasticsearch document
FORBIDDEN_ES_FIELDS = {"account_id", "user_id", "ip_address", "email", "device_id", "raw_text"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_es_client() -> AsyncMock:
    """Return a fully mocked AsyncElasticsearch client."""
    return AsyncMock()


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. No raw text in Elasticsearch documents
# ---------------------------------------------------------------------------

class TestNoRawTextInElasticDocuments:
    """
    Verify that raw thought text NEVER appears in any Elasticsearch document.

    The privacy model requires that only anonymized + humanized text ever
    reaches Elasticsearch. Raw text lives only in request memory and is
    discarded immediately after anonymization.
    """

    @pytest.mark.asyncio
    async def test_index_thought_document_contains_no_raw_pii(self):
        """
        PRIVACY: Document indexed in ES must not contain raw PII keywords.

        Even if the caller (theoretically) passes raw text directly, the
        document must only carry what was passed — but in the real pipeline
        only humanised text is passed. This test confirms that the document
        body forwarded to ES does not carry the raw PII text.
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=HUMANISED_TEXT,
                theme_category=THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document_str = json.dumps(call_kwargs["document"])

        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword not in document_str, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in ES document"
            )

    @pytest.mark.asyncio
    async def test_index_thought_document_has_no_forbidden_fields(self):
        """
        PRIVACY: Elasticsearch document must never contain user-identifying fields.

        account_id, user_id, ip_address, email, device_id must all be absent.
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=HUMANISED_TEXT,
                theme_category=THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        present_forbidden = FORBIDDEN_ES_FIELDS.intersection(set(document.keys()))
        assert not present_forbidden, (
            f"PRIVACY VIOLATION: Forbidden fields in ES document: {present_forbidden}"
        )

    @pytest.mark.asyncio
    async def test_store_resolution_document_has_no_forbidden_fields(self):
        """
        PRIVACY: Resolution update to ES must not contain user-identifying fields.
        """
        mock_client = _make_mock_es_client()
        mock_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=ANONYMISED_TEXT,
            )

        call_kwargs = mock_client.update.call_args.kwargs
        # The update doc is passed as 'doc' kwarg
        update_doc = call_kwargs.get("doc", {})

        present_forbidden = FORBIDDEN_ES_FIELDS.intersection(set(update_doc.keys()))
        assert not present_forbidden, (
            f"PRIVACY VIOLATION: Forbidden fields in ES resolution update: {present_forbidden}"
        )

    @pytest.mark.asyncio
    async def test_store_resolution_document_contains_no_raw_pii(self):
        """
        PRIVACY: Raw resolution PII must not appear in the ES update document.
        """
        mock_client = _make_mock_es_client()
        mock_client.update.return_value = {"result": "updated"}

        # NOTE: In production, the router anonymises resolution_text BEFORE
        # calling store_resolution. Here we verify the update doc for the
        # anonymised text — the anonymised text must not contain raw PII.
        anonymised_resolution = "I spoke to [doctor name] at [hospital] and it helped"

        with patch.object(elastic_module, "_es_client", mock_client):
            await store_resolution(
                message_id=SAMPLE_MESSAGE_ID,
                resolution_text=anonymised_resolution,
            )

        call_kwargs = mock_client.update.call_args.kwargs
        update_doc_str = json.dumps(call_kwargs.get("doc", {}))

        for keyword in RAW_RESOLUTION_KEYWORDS:
            assert keyword not in update_doc_str, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in ES resolution update"
            )

    @pytest.mark.asyncio
    async def test_index_thought_only_contains_expected_fields(self):
        """
        PRIVACY: Indexed document should only contain the declared safe fields.

        This acts as a schema lock — any new field added to the document must
        be explicitly reviewed for privacy implications.
        """
        mock_client = _make_mock_es_client()
        mock_client.index.return_value = {"result": "created"}

        with patch.object(elastic_module, "_es_client", mock_client):
            await index_thought(
                message_id=SAMPLE_MESSAGE_ID,
                humanised_text=HUMANISED_TEXT,
                theme_category=THEME,
                sentiment_vector=SAMPLE_VECTOR,
            )

        call_kwargs = mock_client.index.call_args.kwargs
        document = call_kwargs["document"]

        allowed_fields = {
            "message_id",
            "humanised_text",
            "theme_category",
            "sentiment_vector",
            "timestamp_week",
            "has_resolution",
        }
        extra_fields = set(document.keys()) - allowed_fields
        assert not extra_fields, (
            f"PRIVACY REVIEW REQUIRED: Unexpected fields in ES document: {extra_fields}"
        )


# ---------------------------------------------------------------------------
# 2. No raw text in log output
# ---------------------------------------------------------------------------

class TestNoRawTextInLogs:
    """
    Verify that raw thought text NEVER appears in application log records.

    The Echo logging middleware must never capture request bodies, and the
    thought pipeline must discard raw text before any logging occurs.
    """

    @pytest.mark.asyncio
    async def test_anonymise_service_does_not_log_raw_text(self, caplog):
        """
        PRIVACY: The anonymiser service must not emit raw PII text in log records.
        """
        from services.anonymiser import anonymize_text

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": ANONYMISED_TEXT
        }

        with caplog.at_level(logging.DEBUG, logger="echo"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_http_client = AsyncMock()
                mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
                mock_http_client.__aexit__ = AsyncMock(return_value=False)
                mock_http_client.post = AsyncMock(return_value=mock_response)
                mock_client_cls.return_value = mock_http_client

                try:
                    await anonymize_text(RAW_THOUGHT_PII)
                except Exception:
                    pass  # We only care about log content, not call success

        log_output = caplog.text
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword not in log_output, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in log output"
            )

    @pytest.mark.asyncio
    async def test_elastic_index_does_not_log_humanised_text_verbatim(self, caplog):
        """
        PRIVACY: The elastic service must not emit the full humanised text in error logs.

        Error logs may include message_id for tracing but not the thought content.
        """
        from elasticsearch import TransportError

        mock_client = _make_mock_es_client()
        mock_client.index.side_effect = TransportError("connection refused")

        with caplog.at_level(logging.ERROR, logger="echo"):
            with patch.object(elastic_module, "_es_client", mock_client):
                await index_thought(
                    message_id=SAMPLE_MESSAGE_ID,
                    humanised_text=HUMANISED_TEXT,
                    theme_category=THEME,
                    sentiment_vector=SAMPLE_VECTOR,
                )

        log_output = caplog.text
        # The full humanised text should not be logged
        assert HUMANISED_TEXT not in log_output, (
            "PRIVACY: Humanised thought text found verbatim in error log output"
        )

    def test_thought_submission_error_does_not_log_raw_text(self, client, caplog):
        """
        PRIVACY: When thought submission fails, raw text must not appear in logs.
        """
        with caplog.at_level(logging.DEBUG, logger="echo"):
            with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon:
                mock_anon.side_effect = OllamaConnectionError("service down")

                client.post(
                    "/api/v1/thoughts",
                    json={"text": RAW_THOUGHT_PII},
                )

        log_output = caplog.text
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword not in log_output, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in logs after failed submission"
            )


# ---------------------------------------------------------------------------
# 3. No raw text in error responses
# ---------------------------------------------------------------------------

class TestNoRawTextInErrorResponses:
    """
    Verify that raw thought text NEVER leaks into HTTP error response bodies.

    Even in failure scenarios — anonymiser down, Claude timeout, ES error —
    the raw PII text must never appear in the JSON response body.
    """

    def test_anonymiser_503_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 503 from anonymiser failure must not contain raw thought text.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon:
            mock_anon.side_effect = OllamaConnectionError("service unavailable")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert response.status_code == 503

        response_text = response.text.lower()
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in 503 error response"
            )

    def test_anonymiser_timeout_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 503 from anonymiser timeout must not contain raw thought text.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon:
            mock_anon.side_effect = OllamaTimeoutError("timed out")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert response.status_code == 503

        response_text = response.text.lower()
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in timeout error response"
            )

    def test_anonymiser_bad_response_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 502 from anonymiser invalid response must not contain raw text.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon:
            mock_anon.side_effect = OllamaResponseError("invalid response")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert response.status_code == 502

        response_text = response.text.lower()
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in 502 error response"
            )

    def test_humanisation_failure_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 502 from humanisation failure must not contain raw thought text.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon, \
             patch("routers.thoughts.ai.humanize_thought") as mock_humanise:
            mock_anon.return_value = ANONYMISED_TEXT
            mock_humanise.side_effect = Exception("Claude API error")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert response.status_code == 502

        response_text = response.text.lower()
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in humanisation error response"
            )

    def test_theme_classification_failure_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 502 from theme classification failure must not expose raw text.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon, \
             patch("routers.thoughts.ai.humanize_thought") as mock_humanise, \
             patch("routers.thoughts.ai.classify_theme") as mock_classify:
            mock_anon.return_value = ANONYMISED_TEXT
            mock_humanise.return_value = HUMANISED_TEXT
            mock_classify.side_effect = Exception("classification failed")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert response.status_code == 502

        response_text = response.text.lower()
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in classification error response"
            )

    def test_resolution_anonymiser_503_does_not_echo_raw_text(self, client):
        """
        PRIVACY: HTTP 503 from resolution anonymiser failure must not expose raw text.
        """
        with patch("routers.resolution.anonymiser_service.anonymize_text") as mock_anon:
            mock_anon.side_effect = OllamaConnectionError("service unavailable")

            response = client.post(
                "/api/v1/resolution",
                json={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "resolution_text": RAW_RESOLUTION_PII,
                },
            )

        assert response.status_code == 503

        response_text = response.text.lower()
        for keyword in RAW_RESOLUTION_KEYWORDS:
            assert keyword.lower() not in response_text, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in resolution error response"
            )

    def test_error_response_contains_only_generic_detail(self, client):
        """
        PRIVACY: Error responses should contain only generic user-safe messages.

        The detail field must describe the error category, not reflect any
        user-supplied input.
        """
        with patch("routers.thoughts.anonymiser_service.anonymize_text") as mock_anon:
            mock_anon.side_effect = OllamaConnectionError("service unavailable")

            response = client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        response_data = response.json()
        assert "detail" in response_data

        detail = response_data["detail"]
        # Detail should reference the service problem, not the user's text
        assert "anonymization" in detail.lower() or "service" in detail.lower(), (
            "Error detail should describe the service problem"
        )
        # Detail must not contain raw PII
        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword not in detail, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in error detail"
            )


# ---------------------------------------------------------------------------
# 4. Forbidden fields never appear in Elasticsearch documents (integration)
# ---------------------------------------------------------------------------

class TestForbiddenFieldsNeverInElastic:
    """
    Comprehensive tests confirming no user-identifying fields ever reach ES.

    These tests simulate the full router → service → elastic path using mocks
    to confirm that the entire pipeline never introduces forbidden fields.
    """

    @pytest.mark.asyncio
    async def test_full_pipeline_thought_document_has_no_forbidden_fields(self):
        """
        PRIVACY: Simulate the full thought pipeline and verify ES document integrity.

        Mocks anonymiser, AI, and ES to trace what actually gets indexed.
        """
        mock_es_client = _make_mock_es_client()
        mock_es_client.index.return_value = {"result": "created"}
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0, "relation": "eq"}}
        }

        with patch.object(elastic_module, "_es_client", mock_es_client), \
             patch("routers.thoughts.anonymiser_service.anonymize_text", return_value=ANONYMISED_TEXT), \
             patch("routers.thoughts.ai.humanize_thought", return_value=HUMANISED_TEXT), \
             patch("routers.thoughts.ai.classify_theme", return_value=THEME):

            client = TestClient(app)
            client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        # Verify that an ES index call was made
        assert mock_es_client.index.called, "ES index should have been called"

        # Extract and check the document
        call_kwargs = mock_es_client.index.call_args.kwargs
        document = call_kwargs["document"]

        present_forbidden = FORBIDDEN_ES_FIELDS.intersection(set(document.keys()))
        assert not present_forbidden, (
            f"PRIVACY VIOLATION: Forbidden fields in ES document from full pipeline: {present_forbidden}"
        )

    @pytest.mark.asyncio
    async def test_full_pipeline_thought_document_contains_no_raw_pii(self):
        """
        PRIVACY: ES document from full pipeline must not contain raw PII text.
        """
        mock_es_client = _make_mock_es_client()
        mock_es_client.index.return_value = {"result": "created"}
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0, "relation": "eq"}}
        }

        with patch.object(elastic_module, "_es_client", mock_es_client), \
             patch("routers.thoughts.anonymiser_service.anonymize_text", return_value=ANONYMISED_TEXT), \
             patch("routers.thoughts.ai.humanize_thought", return_value=HUMANISED_TEXT), \
             patch("routers.thoughts.ai.classify_theme", return_value=THEME):

            client = TestClient(app)
            client.post(
                "/api/v1/thoughts",
                json={"text": RAW_THOUGHT_PII},
            )

        assert mock_es_client.index.called

        call_kwargs = mock_es_client.index.call_args.kwargs
        document_str = json.dumps(call_kwargs["document"])

        for keyword in RAW_THOUGHT_KEYWORDS:
            assert keyword not in document_str, (
                f"PRIVACY VIOLATION: PII keyword '{keyword}' found in ES document from full pipeline"
            )

    @pytest.mark.asyncio
    async def test_full_pipeline_resolution_update_has_no_forbidden_fields(self):
        """
        PRIVACY: Resolution update via full pipeline must not contain forbidden fields.
        """
        mock_es_client = _make_mock_es_client()
        mock_es_client.update.return_value = {"result": "updated"}

        with patch.object(elastic_module, "_es_client", mock_es_client), \
             patch("routers.resolution.anonymiser_service.anonymize_text", return_value=ANONYMISED_TEXT):

            client = TestClient(app)
            client.post(
                "/api/v1/resolution",
                json={
                    "message_id": SAMPLE_MESSAGE_ID,
                    "resolution_text": RAW_RESOLUTION_PII,
                },
            )

        if mock_es_client.update.called:
            call_kwargs = mock_es_client.update.call_args.kwargs
            update_doc = call_kwargs.get("doc", {})

            present_forbidden = FORBIDDEN_ES_FIELDS.intersection(set(update_doc.keys()))
            assert not present_forbidden, (
                f"PRIVACY VIOLATION: Forbidden fields in resolution ES update: {present_forbidden}"
            )

    @pytest.mark.asyncio
    async def test_es_search_result_documents_have_no_forbidden_fields(self):
        """
        PRIVACY: Documents returned from ES search results must not contain forbidden fields.

        This checks that the search response parsing doesn't accidentally expose
        forbidden fields even if they hypothetically existed in the index.
        """
        from services.elastic import search_similar_thoughts

        mock_es_client = _make_mock_es_client()
        # Simulate an ES response that (hypothetically) contains forbidden fields
        mock_es_client.search.return_value = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "message_id": "safe-id-001",
                            "humanised_text": "Feeling overwhelmed at work.",
                            "theme_category": "work_stress",
                            "has_resolution": False,
                            # These forbidden fields should be stripped by the service
                            "account_id": "should-not-appear",
                            "user_id": "should-not-appear",
                            "ip_address": "192.168.1.1",
                        },
                        "sort": [1.0, "safe-id-001"],
                    }
                ],
                "total": {"value": 1, "relation": "eq"},
            }
        }

        with patch.object(elastic_module, "_es_client", mock_es_client):
            result = await search_similar_thoughts(
                theme_category=THEME,
                sentiment_vector=SAMPLE_VECTOR,
                limit=20,
            )

        assert len(result["thoughts"]) == 1
        thought = result["thoughts"][0]

        present_forbidden = FORBIDDEN_ES_FIELDS.intersection(set(thought.keys()))
        assert not present_forbidden, (
            f"PRIVACY VIOLATION: Forbidden fields exposed in search result: {present_forbidden}"
        )
