"""
Shared pytest fixtures for the Echo backend test suite.

Provides:
- test_client: FastAPI TestClient for the Echo app
- mock_all_services: patches anonymizer / AI / Elasticsearch so tests
  run without any external dependencies
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_all_services():
    """
    Patch all external service calls used by the thoughts router.

    Patches:
    - anonymiser_service.anonymize_text  (Ollama SLM)
    - ai.humanize_thought                (Claude API)
    - ai.classify_theme                  (Claude API)
    - elastic.index_thought              (Elasticsearch)
    - elastic.search_similar_thoughts    (Elasticsearch)
    - elastic.get_aggregates             (Elasticsearch)

    Yields a dict mapping short names to the mock objects so individual
    tests can inspect call counts / override return values.
    """
    with (
        patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
        ) as mock_anon,
        patch(
            "routers.thoughts.ai.humanize_thought",
            new_callable=AsyncMock,
        ) as mock_humanize,
        patch(
            "routers.thoughts.ai.classify_theme",
            new_callable=AsyncMock,
        ) as mock_classify,
        patch(
            "routers.thoughts.elastic.index_thought",
            new_callable=AsyncMock,
        ) as mock_index,
        patch(
            "routers.thoughts.elastic.search_similar_thoughts",
            new_callable=AsyncMock,
        ) as mock_search,
        patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
        ) as mock_aggregates,
    ):
        # Sensible defaults so tests work without extra setup
        mock_anon.return_value = "My [name] at [company] is difficult to work with"
        mock_humanize.return_value = (
            "Someone at work is making things consistently difficult for me."
        )
        mock_classify.return_value = "work_stress"
        mock_index.return_value = True
        mock_search.return_value = {
            "thoughts": [
                {
                    "message_id": "test-sim-001",
                    "humanised_text": "A colleague makes me feel undervalued.",
                    "theme_category": "work_stress",
                    "has_resolution": False,
                    "resolution_text": None,
                }
            ],
            "total": 42,
            "search_after": None,
        }
        mock_aggregates.return_value = [
            {"theme": "work_stress", "count": 847},
            {"theme": "anxiety", "count": 634},
        ]

        yield {
            "anonymize": mock_anon,
            "humanize": mock_humanize,
            "classify": mock_classify,
            "index": mock_index,
            "search": mock_search,
            "aggregates": mock_aggregates,
        }
