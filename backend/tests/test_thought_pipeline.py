"""
Integration tests for the thought pipeline.

Covers:
- POST /api/v1/thoughts happy path
- Privacy invariant: anonymizer is called FIRST before humanizer
- Humanizer receives anonymized text, NOT raw text
- Response shape: message_id, theme_category, match_count, similar_thoughts, search_after
- Error flows: 503 on OllamaConnectionError, 503 on OllamaTimeoutError, 502 on humanizer failure
- GET /api/v1/thoughts/aggregates falls back to demo data when Elastic returns empty list
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from services.anonymiser import OllamaConnectionError, OllamaTimeoutError

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


_SEEDED_VECTOR = [0.1] * 384


def _make_search_result(
    thoughts: list[dict] | None = None,
    total: int = 5,
    search_after: list | None = None,
) -> dict:
    """Build a minimal elastic.search_similar_thoughts return value."""
    return {
        "thoughts": thoughts or [
            {
                "message_id": "sim-001",
                "humanised_text": "Someone at work makes me feel small.",
                "theme_category": "work_stress",
                "has_resolution": False,
                "resolution_text": None,
            }
        ],
        "total": total,
        "search_after": search_after,
    }


def _standard_pipeline_mocks():
    """Return a context manager stack that patches the full thought pipeline."""
    return (
        patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock),
        patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock),
        patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
        patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
        patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock),
    )


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


class TestSubmitThoughtHappyPath:
    """Tests for the successful POST /api/v1/thoughts flow."""

    def test_response_shape_has_required_fields(self, client):
        """Response must contain message_id, theme_category, match_count, similar_thoughts, search_after."""
        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
            patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock) as mock_hc,
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_anon.return_value = "My [male name] at [tech company] undermines me"
            mock_hc.return_value = ("Someone at work consistently undermines me.", "work_stress")
            mock_search.return_value = _make_search_result(total=42, search_after=["cursor-val"])

            response = client.post(
                "/api/v1/thoughts",
                json={"text": "My boss David at Google undermines me"},
            )

        assert response.status_code == 200
        data = response.json()

        # All required keys must be present
        assert "message_id" in data
        assert "theme_category" in data
        assert "match_count" in data
        assert "similar_thoughts" in data
        assert "search_after" in data

    def test_response_values_are_correct(self, client):
        """Response values reflect what the mocked services return."""
        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
            patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock) as mock_hc,
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_anon.return_value = "My [male name] at [tech company] undermines me"
            mock_hc.return_value = ("Someone at work consistently undermines me.", "work_stress")
            mock_search.return_value = _make_search_result(total=99, search_after=["ts123", "id456"])

            response = client.post(
                "/api/v1/thoughts",
                json={"text": "My boss David at Google undermines me"},
            )

        data = response.json()
        assert data["theme_category"] == "work_stress"
        assert data["match_count"] == 99
        assert data["search_after"] == ["ts123", "id456"]
        assert isinstance(data["message_id"], str)
        assert len(data["message_id"]) > 0
        assert isinstance(data["similar_thoughts"], list)

    def test_similar_thoughts_shape(self, client):
        """Each item in similar_thoughts must have the expected fields."""
        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
            patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock) as mock_hc,
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_anon.return_value = "I feel overwhelmed at [workplace]"
            mock_hc.return_value = ("Work is crushing my spirit.", "burnout")
            mock_search.return_value = _make_search_result(
                thoughts=[
                    {
                        "message_id": "abc-123",
                        "humanised_text": "I feel crushed by expectations.",
                        "theme_category": "burnout",
                        "has_resolution": True,
                        "resolution_text": "I talked to my manager.",
                    }
                ],
                total=1,
            )

            response = client.post("/api/v1/thoughts", json={"text": "I hate my job"})

        data = response.json()
        assert len(data["similar_thoughts"]) == 1
        thought = data["similar_thoughts"][0]
        assert thought["message_id"] == "abc-123"
        assert thought["humanised_text"] == "I feel crushed by expectations."
        assert thought["theme_category"] == "burnout"
        assert thought["has_resolution"] is True
        assert thought["resolution_text"] == "I talked to my manager."

    def test_search_after_is_none_when_no_cursor(self, client):
        """search_after should be null in the response when elastic returns None."""
        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
            patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock) as mock_hc,
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_anon.return_value = "I feel lonely"
            mock_hc.return_value = ("Loneliness weighs on me.", "loneliness")
            mock_search.return_value = _make_search_result(total=2, search_after=None)

            response = client.post("/api/v1/thoughts", json={"text": "I feel alone"})

        data = response.json()
        assert data["search_after"] is None


# ---------------------------------------------------------------------------
# Privacy invariant tests
# ---------------------------------------------------------------------------


class TestPrivacyInvariants:
    """
    CRITICAL: Verify the anonymizer-first privacy invariant is upheld.

    The anonymizer MUST be called before the humanizer. The humanizer
    MUST receive the anonymized text, NOT the raw text.
    """

    def test_anonymizer_is_called_before_humanizer(self, client):
        """Privacy invariant: anonymizer must be invoked before humanizer."""
        call_order: list[str] = []

        async def spy_anonymize(text: str) -> str:
            call_order.append("anonymize")
            return "anonymized text"

        async def spy_humanize_and_classify(text: str) -> tuple[str, str]:
            call_order.append("humanize_and_classify")
            return "humanised text", "work_stress"

        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", side_effect=spy_anonymize),
            patch("routers.thoughts.ai.humanize_and_classify", side_effect=spy_humanize_and_classify),
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_search.return_value = _make_search_result()
            client.post(
                "/api/v1/thoughts",
                json={"text": "My boss Sarah at Facebook controls me"},
            )

        # anonymize must appear before humanize_and_classify in the call order
        assert "anonymize" in call_order
        assert "humanize_and_classify" in call_order
        anon_index = call_order.index("anonymize")
        hc_index = call_order.index("humanize_and_classify")
        assert anon_index < hc_index, (
            "PRIVACY VIOLATION: humanizer was called before anonymizer"
        )

    def test_humanizer_receives_anonymized_text_not_raw(self, client):
        """Humanizer must receive anonymized output, not the original raw text."""
        raw_text = "My boss David at Google undermines me in front of the team"
        anonymized_text = "My [male name] at [tech company] undermines me in front of the [group]"
        humanizer_received: list[str] = []

        async def mock_anonymize(text: str) -> str:
            return anonymized_text

        async def mock_humanize_and_classify(text: str) -> tuple[str, str]:
            humanizer_received.append(text)
            return "Someone at work undermines me in meetings.", "work_stress"

        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", side_effect=mock_anonymize),
            patch("routers.thoughts.ai.humanize_and_classify", side_effect=mock_humanize_and_classify),
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_search.return_value = _make_search_result()
            client.post("/api/v1/thoughts", json={"text": raw_text})

        assert len(humanizer_received) == 1
        # Humanizer must have received the anonymized text
        assert humanizer_received[0] == anonymized_text, (
            "PRIVACY VIOLATION: humanizer received non-anonymized text"
        )
        # Humanizer must NOT have received the raw text
        assert humanizer_received[0] != raw_text, (
            "PRIVACY VIOLATION: humanizer received raw text directly"
        )

    def test_raw_text_not_in_response(self, client):
        """Raw PII text must not appear anywhere in the response body."""
        raw_text = "My colleague Alice at HSBC bank is stalking me"

        with (
            patch("routers.thoughts.anonymiser_service.anonymize_text", new_callable=AsyncMock) as mock_anon,
            patch("routers.thoughts.ai.humanize_and_classify", new_callable=AsyncMock) as mock_hc,
            patch("routers.thoughts.embeddings.embed", new_callable=AsyncMock, return_value=_SEEDED_VECTOR),
            patch("routers.thoughts.elastic.index_thought", new_callable=AsyncMock, return_value=True),
            patch("routers.thoughts.elastic.search_similar_thoughts", new_callable=AsyncMock) as mock_search,
        ):
            mock_anon.return_value = "My [female name] at [bank] is [threatening me]"
            mock_hc.return_value = ("A coworker is making me feel unsafe.", "work_stress")
            mock_search.return_value = _make_search_result()

            response = client.post("/api/v1/thoughts", json={"text": raw_text})

        response_text = response.text
        for pii_token in ["Alice", "HSBC", "stalking"]:
            assert pii_token not in response_text, (
                f"PRIVACY VIOLATION: PII token '{pii_token}' found in response"
            )


# ---------------------------------------------------------------------------
# Error flow tests
# ---------------------------------------------------------------------------


class TestThoughtPipelineErrors:
    """Tests for error handling in the thought submission pipeline."""

    def test_returns_503_on_ollama_connection_error(self, client):
        """OllamaConnectionError during anonymization must yield HTTP 503."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError(
                "Could not connect to Ollama. Is it running?"
            )
            response = client.post(
                "/api/v1/thoughts",
                json={"text": "I feel overwhelmed by work"},
            )

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        # Error detail must not contain raw input text
        assert "overwhelmed" not in data["detail"].lower()

    def test_returns_503_on_ollama_timeout_error(self, client):
        """OllamaTimeoutError during anonymization must yield HTTP 503."""
        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaTimeoutError("Ollama request timed out.")
            response = client.post(
                "/api/v1/thoughts",
                json={"text": "I feel overwhelmed by work"},
            )

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data

    def test_returns_502_on_humanizer_exception(self, client):
        """Any exception in humanize_and_classify must yield HTTP 502."""
        with (
            patch(
                "routers.thoughts.anonymiser_service.anonymize_text",
                new_callable=AsyncMock,
                return_value="anonymized text",
            ),
            patch(
                "routers.thoughts.ai.humanize_and_classify",
                new_callable=AsyncMock,
            ) as mock_hc,
        ):
            mock_hc.side_effect = Exception("API error")
            response = client.post(
                "/api/v1/thoughts",
                json={"text": "I feel overwhelmed by work"},
            )

        assert response.status_code == 502
        data = response.json()
        assert "detail" in data

    def test_error_detail_does_not_leak_raw_text_on_503(self, client):
        """503 error messages must never contain raw PII text."""
        raw_with_pii = "My boss Marcus at Deloitte is ruining my career"

        with patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon:
            mock_anon.side_effect = OllamaConnectionError("Cannot connect")
            response = client.post("/api/v1/thoughts", json={"text": raw_with_pii})

        assert response.status_code == 503
        response_body = response.text.lower()
        for pii_token in ["marcus", "deloitte", "ruining"]:
            assert pii_token not in response_body, (
                f"PRIVACY VIOLATION: PII token '{pii_token}' in 503 error response"
            )


# ---------------------------------------------------------------------------
# Aggregates endpoint tests
# ---------------------------------------------------------------------------


class TestGetThemeAggregates:
    """Tests for GET /api/v1/thoughts/aggregates."""

    def test_returns_demo_data_when_elastic_returns_empty_list(self, client):
        """Aggregates endpoint must fall back to demo data when Elastic returns []."""
        with patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        data = response.json()

        # Must return a non-empty list (demo data)
        assert isinstance(data, list)
        assert len(data) > 0

        # Each item must have theme and count keys
        for item in data:
            assert "theme" in item
            assert "count" in item
            assert isinstance(item["count"], int)
            assert item["count"] > 0

    def test_returns_elastic_data_when_available(self, client):
        """Aggregates endpoint returns live Elastic data when available."""
        live_data = [
            {"theme": "anxiety", "count": 312},
            {"theme": "work_stress", "count": 201},
        ]
        with patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
            return_value=live_data,
        ):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        data = response.json()
        assert data == live_data

    def test_demo_data_contains_expected_themes(self, client):
        """Fallback demo data must include common emotional themes."""
        with patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = client.get("/api/v1/thoughts/aggregates")

        data = response.json()
        themes = {item["theme"] for item in data}

        # Core themes that seed the demo experience
        expected_themes = {"work_stress", "anxiety", "loneliness"}
        assert expected_themes.issubset(themes), (
            f"Demo data missing expected themes. Found: {themes}"
        )

    def test_returns_list_not_dict(self, client):
        """Aggregates response must be a list, not wrapped in a dict."""
        with patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = client.get("/api/v1/thoughts/aggregates")

        assert response.status_code == 200
        assert isinstance(response.json(), list)
