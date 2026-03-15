"""
Shared pytest fixtures for the Echo backend test suite.

Provides:
- test_client: FastAPI TestClient for the Echo app (no mocks)
- client: TestClient with all external services mocked (ES, anonymiser, AI, embeddings)
- mock_es_client: Pre-seeded AsyncMock for the Elasticsearch client
- mock_all_services: patches anonymizer / AI / Elasticsearch so tests
  run without any external dependencies
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from database import Base, get_async_db
from main import app
from middleware.rate_limit import _rate_limiter

# In-memory SQLite for tests — no Postgres needed
_test_async_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestAsyncSessionLocal = async_sessionmaker(
    _test_async_engine, class_=AsyncSession, expire_on_commit=False,
)


async def _test_get_async_db():
    async with _TestAsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Shared constants — used by integration and error-scenario tests
# ---------------------------------------------------------------------------

SEEDED_MESSAGE_ID = "seeded-msg-id-0001"
SEEDED_THEME = "work_stress"
SEEDED_HUMANISED_TEXT = (
    "Someone at work consistently undermines my confidence and contributions."
)
SEEDED_ANONYMISED_RESOLUTION = (
    "I spoke to [job title] and things improved significantly."
)
_SEEDED_VECTOR = [0.1] * 384


# ---------------------------------------------------------------------------
# Helper: build a pre-seeded mock Elasticsearch client
# ---------------------------------------------------------------------------

def _make_mock_es_client() -> AsyncMock:
    """
    Return a pre-seeded AsyncMock for the Elasticsearch client.

    Default behaviour:
    - .get() returns a thought document for SEEDED_MESSAGE_ID
    - .search() returns a single similar thought
    - .index() returns {"result": "created"}
    - .update() returns {"result": "updated"}
    """
    mock = AsyncMock()

    # Default: get_thought_by_id finds the seeded thought
    mock.get.return_value = {
        "_source": {
            "message_id": SEEDED_MESSAGE_ID,
            "humanised_text": SEEDED_HUMANISED_TEXT,
            "theme_category": SEEDED_THEME,
            "sentiment_vector": _SEEDED_VECTOR,
            "has_resolution": False,
        }
    }

    # Default: search returns one seeded similar thought
    mock.search.return_value = {
        "hits": {
            "hits": [
                {
                    "_source": {
                        "message_id": SEEDED_MESSAGE_ID,
                        "humanised_text": SEEDED_HUMANISED_TEXT,
                        "theme_category": SEEDED_THEME,
                        "has_resolution": False,
                    },
                    "sort": [1.0, SEEDED_MESSAGE_ID],
                }
            ],
            "total": {"value": 42, "relation": "eq"},
        }
    }

    mock.index.return_value = {"result": "created"}
    mock.update.return_value = {"result": "updated"}
    mock.indices.exists.return_value = True
    mock.indices.create.return_value = {"acknowledged": True}

    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear the in-memory rate limiter before every test to prevent 429s."""
    _rate_limiter.clear_all()
    yield
    _rate_limiter.clear_all()


@pytest.fixture(autouse=True)
async def _setup_test_db():
    """Create tables in in-memory SQLite and override get_async_db for each test."""
    async with _test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app.dependency_overrides[get_async_db] = _test_get_async_db

    yield

    async with _test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    app.dependency_overrides.pop(get_async_db, None)


@pytest.fixture
def mock_es_client() -> AsyncMock:
    """Pre-seeded Elasticsearch mock client (function-scoped)."""
    return _make_mock_es_client()


@pytest.fixture
def client(mock_es_client: AsyncMock) -> TestClient:
    """
    TestClient with ALL external services patched:
    - Elasticsearch client (_es_client)
    - Anonymiser service (thoughts + resolution routers)
    - AI service (humanize_thought, classify_theme)
    - Embeddings service (embed)
    - Elasticsearch lifecycle (init/close)

    The mock_es_client fixture is shared so tests can mutate it to control
    ES responses before making HTTP calls.
    """
    import main as main_module
    import services.elastic as elastic_module

    with (
        patch.object(elastic_module, "_es_client", mock_es_client),
        patch.object(main_module, "init_db", new_callable=MagicMock),
        patch.object(main_module, "init_elasticsearch", new_callable=AsyncMock),
        patch.object(main_module, "close_elasticsearch", new_callable=AsyncMock),
        patch(
            "routers.thoughts.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            return_value=SEEDED_ANONYMISED_RESOLUTION,
        ),
        patch(
            "routers.resolution.anonymiser_service.anonymize_text",
            new_callable=AsyncMock,
            return_value=SEEDED_ANONYMISED_RESOLUTION,
        ),
        patch(
            "routers.thoughts.ai.humanize_thought",
            new_callable=AsyncMock,
            return_value=SEEDED_HUMANISED_TEXT,
        ),
        patch(
            "routers.thoughts.ai.classify_theme",
            new_callable=AsyncMock,
            return_value=SEEDED_THEME,
        ),
        patch(
            "routers.thoughts.ai.humanize_and_classify",
            new_callable=AsyncMock,
            return_value=(SEEDED_HUMANISED_TEXT, SEEDED_THEME),
        ),
        patch(
            "routers.thoughts.embeddings.embed",
            new_callable=AsyncMock,
            return_value=_SEEDED_VECTOR,
        ),
        patch(
            "routers.thoughts.elastic.index_thought",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "routers.thoughts.elastic.search_similar_thoughts",
            new_callable=AsyncMock,
            return_value={
                "thoughts": [
                    {
                        "message_id": SEEDED_MESSAGE_ID,
                        "humanised_text": SEEDED_HUMANISED_TEXT,
                        "theme_category": SEEDED_THEME,
                        "has_resolution": False,
                        "resolution_text": None,
                    }
                ],
                "total": 42,
                "search_after": None,
            },
        ),
        patch(
            "routers.thoughts.elastic.get_thought_by_id",
            new_callable=AsyncMock,
            return_value={
                "message_id": SEEDED_MESSAGE_ID,
                "humanised_text": SEEDED_HUMANISED_TEXT,
                "theme_category": SEEDED_THEME,
                "sentiment_vector": _SEEDED_VECTOR,
                "has_resolution": False,
            },
        ),
        patch(
            "routers.thoughts.elastic.get_aggregates",
            new_callable=AsyncMock,
            return_value=[
                {
                    "theme": "work_stress",
                    "count": 847,
                    "resolution_count": 186,
                    "resolution_rate": 22,
                },
                {
                    "theme": "general_anxiety",
                    "count": 634,
                    "resolution_count": 120,
                    "resolution_rate": 19,
                },
            ],
        ),
        patch(
            "routers.thoughts.elastic.get_aggregates_monthly",
            new_callable=AsyncMock,
            return_value=[
                {"theme": "work_stress", "count": 2847, "resolution_count": 586, "resolution_rate": 21},
                {"theme": "anxiety", "count": 2134, "resolution_count": 420, "resolution_rate": 20},
            ],
        ),
        patch(
            "routers.resolution.elastic.store_resolution",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "routers.resolution.elastic.get_resolution",
            new_callable=AsyncMock,
            return_value={
                "message_id": SEEDED_MESSAGE_ID,
                "anonymised_text": SEEDED_ANONYMISED_RESOLUTION,
            },
        ),
    ):
        yield TestClient(app)


@pytest.fixture
def test_client():
    """Create a bare test client for the FastAPI app (no service mocks)."""
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
    - embeddings.embed                   (sentence-transformers)

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
            "routers.thoughts.ai.humanize_and_classify",
            new_callable=AsyncMock,
        ) as mock_humanize_and_classify,
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
        patch(
            "routers.thoughts.embeddings.embed",
            new_callable=AsyncMock,
        ) as mock_embed,
    ):
        # Sensible defaults so tests work without extra setup
        mock_anon.return_value = "My [name] at [company] is difficult to work with"
        mock_humanize.return_value = (
            "Someone at work is making things consistently difficult for me."
        )
        mock_classify.return_value = SEEDED_THEME
        mock_humanize_and_classify.return_value = (
            "Someone at work is making things consistently difficult for me.",
            SEEDED_THEME,
        )
        mock_index.return_value = True
        mock_embed.return_value = _SEEDED_VECTOR
        mock_search.return_value = {
            "thoughts": [
                {
                    "message_id": "test-sim-001",
                    "humanised_text": "A colleague makes me feel undervalued.",
                    "theme_category": SEEDED_THEME,
                    "has_resolution": False,
                    "resolution_text": None,
                }
            ],
            "total": 42,
            "search_after": None,
        }
        mock_aggregates.return_value = [
            {
                "theme": "work_stress",
                "count": 847,
                "resolution_count": 186,
                "resolution_rate": 22,
            },
            {
                "theme": "general_anxiety",
                "count": 634,
                "resolution_count": 120,
                "resolution_rate": 19,
            },
        ]

        yield {
            "anonymize": mock_anon,
            "humanize": mock_humanize,
            "classify": mock_classify,
            "humanize_and_classify": mock_humanize_and_classify,
            "index": mock_index,
            "search": mock_search,
            "aggregates": mock_aggregates,
            "embed": mock_embed,
        }
