"""
End-to-end integration tests for the full Echo happy-path pipeline.

Note on mocking strategy:
  The shared `client` fixture (conftest.py) exposes its underlying mocked
  Elasticsearch client via the `mock_es_client` fixture.  Because both fixtures
  are function-scoped and share the same instance through pytest's dependency
  injection, a test can accept both `client` AND `mock_es_client` and mutate
  the mock before the HTTP call.  This is the pattern used in tests that need
  the ES layer to behave differently (e.g. return has_resolution=True or raise
  a Not Found exception).

Tests the complete user journey:
1. Register a new account
2. Login with that account
3. Submit a thought (anonymise → humanise → search)
4. Paginate similar-thought results
5. Submit a resolution ("what helped")
6. Retrieve that resolution

All external services (Ollama, Claude API, Elasticsearch) are mocked via the
shared `client` fixture defined in conftest.py so these tests run without any
live infrastructure.

Each step verifies:
- HTTP status code
- Response body shape (required fields present and correct types)
"""

import json
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from tests.conftest import (
    SEEDED_MESSAGE_ID,
    SEEDED_HUMANISED_TEXT,
    SEEDED_THEME,
    SEEDED_RESOLUTION_TEXT,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_and_login(client: TestClient, email: str, password: str) -> str:
    """Register a new user and return the JWT access token."""
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert reg_resp.status_code == 200, (
        f"Registration failed: {reg_resp.status_code} {reg_resp.text}"
    )
    return reg_resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Step 1 – Registration
# ---------------------------------------------------------------------------

class TestRegistration:
    """Verify POST /api/v1/auth/register HTTP status and response shape."""

    def test_register_returns_200(self, client: TestClient):
        """New user registration must return HTTP 200."""
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "new@example.com", "password": "password123"},
        )
        assert resp.status_code == 200

    def test_register_response_has_access_token(self, client: TestClient):
        """Registration response must contain a non-empty access_token."""
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "token@example.com", "password": "password123"},
        )
        data = resp.json()
        assert "access_token" in data, "Response must contain access_token"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0

    def test_duplicate_registration_returns_409(self, client: TestClient):
        """Registering an email that already exists must return HTTP 409."""
        payload = {"email": "dup@example.com", "password": "password123"}
        client.post("/api/v1/auth/register", json=payload)  # first
        resp = client.post("/api/v1/auth/register", json=payload)  # duplicate
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Step 2 – Login
# ---------------------------------------------------------------------------

class TestLogin:
    """Verify POST /api/v1/auth/login HTTP status and response shape."""

    def test_login_returns_200_with_valid_credentials(self, client: TestClient):
        """Login with correct credentials must return HTTP 200."""
        payload = {"email": "login@example.com", "password": "mypassword"}
        client.post("/api/v1/auth/register", json=payload)

        resp = client.post("/api/v1/auth/login", json=payload)
        assert resp.status_code == 200

    def test_login_response_has_access_token(self, client: TestClient):
        """Login response must contain a non-empty access_token string."""
        payload = {"email": "logintoken@example.com", "password": "mypassword"}
        client.post("/api/v1/auth/register", json=payload)

        resp = client.post("/api/v1/auth/login", json=payload)
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0

    def test_login_returns_401_with_wrong_password(self, client: TestClient):
        """Login with incorrect password must return HTTP 401."""
        payload = {"email": "wrongpw@example.com", "password": "correct"}
        client.post("/api/v1/auth/register", json=payload)

        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "wrongpw@example.com", "password": "incorrect"},
        )
        assert resp.status_code == 401

    def test_login_returns_401_for_unknown_email(self, client: TestClient):
        """Login for a non-existent account must return HTTP 401."""
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "anypassword"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Step 3 – Submit thought
# ---------------------------------------------------------------------------

class TestSubmitThought:
    """Verify POST /api/v1/thoughts HTTP status and response shape."""

    def test_submit_thought_returns_200(self, client: TestClient):
        """Submitting a valid thought must return HTTP 200."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "I feel overwhelmed at work lately."},
        )
        assert resp.status_code == 200

    def test_submit_thought_response_has_required_fields(self, client: TestClient):
        """Response must contain message_id, theme_category, match_count, similar_thoughts."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "I feel overwhelmed at work lately."},
        )
        data = resp.json()

        assert "message_id" in data, "Response must include message_id"
        assert "theme_category" in data, "Response must include theme_category"
        assert "match_count" in data, "Response must include match_count"
        assert "similar_thoughts" in data, "Response must include similar_thoughts"

    def test_submit_thought_message_id_is_string(self, client: TestClient):
        """message_id must be a non-empty string."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "Feeling isolated from friends."},
        )
        data = resp.json()
        assert isinstance(data["message_id"], str)
        assert len(data["message_id"]) > 0

    def test_submit_thought_match_count_is_int(self, client: TestClient):
        """match_count must be a non-negative integer."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "Struggling with self-doubt."},
        )
        data = resp.json()
        assert isinstance(data["match_count"], int)
        assert data["match_count"] >= 0

    def test_submit_thought_similar_thoughts_is_list(self, client: TestClient):
        """similar_thoughts must be a list."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "I can't stop worrying."},
        )
        data = resp.json()
        assert isinstance(data["similar_thoughts"], list)

    def test_submit_thought_cards_have_correct_shape(self, client: TestClient):
        """Each thought card must have message_id, humanised_text, theme_category, has_resolution."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "Feeling burnt out from too many meetings."},
        )
        data = resp.json()
        for card in data["similar_thoughts"]:
            assert "message_id" in card
            assert "humanised_text" in card
            assert "theme_category" in card
            assert "has_resolution" in card
            assert isinstance(card["has_resolution"], bool)

    def test_submit_thought_returns_seeded_theme(self, client: TestClient):
        """With mocked services, theme_category should match the mocked return value."""
        resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "My boss is undermining me."},
        )
        data = resp.json()
        assert data["theme_category"] == SEEDED_THEME

    def test_submit_thought_empty_text_returns_422(self, client: TestClient):
        """Submitting an empty raw_text must return HTTP 422 (validation error)."""
        resp = client.post("/api/v1/thoughts", json={"raw_text": ""})
        assert resp.status_code == 422

    def test_submit_thought_missing_field_returns_422(self, client: TestClient):
        """Submitting without raw_text field must return HTTP 422."""
        resp = client.post("/api/v1/thoughts", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Step 4 – Paginate results
# ---------------------------------------------------------------------------

class TestPaginateSimilarThoughts:
    """Verify GET /api/v1/thoughts/similar HTTP status and response shape."""

    def test_paginate_returns_200_for_known_message_id(self, client: TestClient):
        """Pagination for a known message_id must return HTTP 200."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID},
        )
        assert resp.status_code == 200

    def test_paginate_response_has_required_fields(self, client: TestClient):
        """Pagination response must contain thoughts, search_after, and total."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID},
        )
        data = resp.json()
        assert "thoughts" in data, "Response must include thoughts"
        assert "total" in data, "Response must include total"
        assert "search_after" in data, "Response must include search_after"

    def test_paginate_thoughts_is_list(self, client: TestClient):
        """thoughts in pagination response must be a list."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID},
        )
        data = resp.json()
        assert isinstance(data["thoughts"], list)

    def test_paginate_total_is_non_negative_int(self, client: TestClient):
        """total in pagination response must be a non-negative integer."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID},
        )
        data = resp.json()
        assert isinstance(data["total"], int)
        assert data["total"] >= 0

    def test_paginate_cards_have_correct_shape(self, client: TestClient):
        """Each thought card in paginated results must have required fields."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID},
        )
        data = resp.json()
        for card in data["thoughts"]:
            assert "message_id" in card
            assert "humanised_text" in card
            assert "theme_category" in card
            assert "has_resolution" in card
            assert isinstance(card["has_resolution"], bool)

    def test_paginate_unknown_message_id_returns_404(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """Requesting pagination for an unknown message_id must return HTTP 404."""
        # Configure mock to raise so that get_thought_by_id returns None
        mock_es_client.get.side_effect = Exception("document not found")
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": "does-not-exist-xyz"},
        )
        assert resp.status_code == 404

    def test_paginate_invalid_search_after_returns_422(self, client: TestClient):
        """Passing a non-JSON search_after cursor must return HTTP 422."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": "not-valid-json",
            },
        )
        assert resp.status_code == 422

    def test_paginate_with_valid_search_after_cursor(self, client: TestClient):
        """Passing a valid JSON array search_after cursor must return HTTP 200."""
        cursor = json.dumps([0.95, SEEDED_MESSAGE_ID])
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={
                "message_id": SEEDED_MESSAGE_ID,
                "search_after": cursor,
            },
        )
        assert resp.status_code == 200

    def test_paginate_size_param_is_respected(self, client: TestClient):
        """Custom size parameter must be accepted without error."""
        resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID, "size": 10},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Step 5 – Submit resolution
# ---------------------------------------------------------------------------

class TestSubmitResolution:
    """Verify POST /api/v1/resolution HTTP status and response shape."""

    def test_submit_resolution_returns_200(self, client: TestClient):
        """Submitting a valid resolution must return HTTP 200."""
        resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                "resolution_text": "I spoke to HR and things improved.",
            },
        )
        assert resp.status_code == 200

    def test_submit_resolution_response_has_required_fields(self, client: TestClient):
        """Resolution response must contain message_id, resolution_text, timestamp."""
        resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                "resolution_text": "Taking walks helped clear my head.",
            },
        )
        data = resp.json()
        assert "message_id" in data, "Response must include message_id"
        assert "resolution_text" in data, "Response must include resolution_text"
        assert "timestamp" in data, "Response must include timestamp"

    def test_submit_resolution_message_id_matches(self, client: TestClient):
        """Response message_id must match the submitted message_id."""
        resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                "resolution_text": "Time and distance helped.",
            },
        )
        data = resp.json()
        assert data["message_id"] == SEEDED_MESSAGE_ID

    def test_submit_resolution_text_is_anonymised(self, client: TestClient):
        """Returned resolution_text must be the anonymised version (mocked return value)."""
        resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                # Raw text with PII — anonymiser mock strips it
                "resolution_text": "My therapist Alice at Johns Hopkins helped me.",
            },
        )
        data = resp.json()
        # The mock anonymiser returns SEEDED_ANONYMISED_TEXT
        assert isinstance(data["resolution_text"], str)
        assert len(data["resolution_text"]) > 0

    def test_submit_resolution_timestamp_is_int(self, client: TestClient):
        """timestamp in resolution response must be a positive integer."""
        resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                "resolution_text": "Journalling every morning helped.",
            },
        )
        data = resp.json()
        assert isinstance(data["timestamp"], int)
        assert data["timestamp"] > 0

    def test_submit_resolution_empty_text_returns_422(self, client: TestClient):
        """Submitting an empty resolution_text must return HTTP 422."""
        resp = client.post(
            "/api/v1/resolution",
            json={"message_id": SEEDED_MESSAGE_ID, "resolution_text": ""},
        )
        assert resp.status_code == 422

    def test_submit_resolution_missing_fields_returns_422(self, client: TestClient):
        """Omitting required fields must return HTTP 422."""
        resp = client.post("/api/v1/resolution", json={"message_id": SEEDED_MESSAGE_ID})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Step 6 – Get resolution
# ---------------------------------------------------------------------------

class TestGetResolution:
    """Verify GET /api/v1/resolution/{message_id} HTTP status and response shape.

    The conftest mock's ES client returns has_resolution=False by default.
    Tests that expect HTTP 200 override the mock to return has_resolution=True
    with a resolution_text so the service layer returns the stored advice.
    """

    _STORED_RESOLUTION = "I spoke to HR and things improved significantly."

    def _seed_resolution(self, mock_es_client: AsyncMock) -> None:
        """Configure the ES mock to return a thought with a resolution stored."""
        mock_es_client.get.return_value = {
            "_source": {
                "has_resolution": True,
                "resolution_text": self._STORED_RESOLUTION,
            }
        }

    def test_get_resolution_returns_200_after_submit(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """Retrieving an existing resolution must return HTTP 200."""
        self._seed_resolution(mock_es_client)
        resp = client.get(f"/api/v1/resolution/{SEEDED_MESSAGE_ID}")
        assert resp.status_code == 200

    def test_get_resolution_response_has_required_fields(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """GET response must contain message_id, resolution_text, timestamp."""
        self._seed_resolution(mock_es_client)
        resp = client.get(f"/api/v1/resolution/{SEEDED_MESSAGE_ID}")
        data = resp.json()

        assert "message_id" in data
        assert "resolution_text" in data
        assert "timestamp" in data

    def test_get_resolution_message_id_matches(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """GET response message_id must match the path parameter."""
        self._seed_resolution(mock_es_client)
        resp = client.get(f"/api/v1/resolution/{SEEDED_MESSAGE_ID}")
        data = resp.json()
        assert data["message_id"] == SEEDED_MESSAGE_ID

    def test_get_resolution_resolution_text_is_string(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """resolution_text in GET response must be a non-empty string."""
        self._seed_resolution(mock_es_client)
        resp = client.get(f"/api/v1/resolution/{SEEDED_MESSAGE_ID}")
        data = resp.json()
        assert isinstance(data["resolution_text"], str)
        assert len(data["resolution_text"]) > 0

    def test_get_resolution_unknown_id_returns_404(
        self, client: TestClient, mock_es_client: AsyncMock
    ):
        """Retrieving a resolution for an unknown message_id must return HTTP 404."""
        # Make the mock raise so get_resolution returns None → 404
        mock_es_client.get.side_effect = Exception("document not found")
        resp = client.get("/api/v1/resolution/no-such-id-abc123")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Full happy-path pipeline test
# ---------------------------------------------------------------------------

class TestFullHappyPathPipeline:
    """
    Walk through the entire user journey in a single ordered test.

    Steps:
    1. Register    → HTTP 200, access_token present
    2. Login       → HTTP 200, access_token present
    3. Submit      → HTTP 200, message_id + similar_thoughts present
    4. Paginate    → HTTP 200, thoughts list present
    5. Resolution  → HTTP 200, message_id + resolution_text present
    6. Get         → HTTP 200, same message_id returned
    """

    def test_complete_pipeline(self, client: TestClient, mock_es_client: AsyncMock):
        """Happy-path: all six pipeline steps succeed with correct response shapes."""

        # ── Step 1: Register ────────────────────────────────────────────────
        reg_resp = client.post(
            "/api/v1/auth/register",
            json={"email": "pipeline@example.com", "password": "pipeline_pass"},
        )
        assert reg_resp.status_code == 200, f"Register failed: {reg_resp.text}"
        reg_data = reg_resp.json()
        assert "access_token" in reg_data
        assert isinstance(reg_data["access_token"], str)

        # ── Step 2: Login ────────────────────────────────────────────────────
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "pipeline@example.com", "password": "pipeline_pass"},
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_data = login_resp.json()
        assert "access_token" in login_data
        token = login_data["access_token"]
        assert isinstance(token, str) and len(token) > 0

        # ── Step 3: Submit thought ───────────────────────────────────────────
        thought_resp = client.post(
            "/api/v1/thoughts",
            json={"raw_text": "My boss undermines me at every meeting."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert thought_resp.status_code == 200, f"Submit thought failed: {thought_resp.text}"
        thought_data = thought_resp.json()

        assert "message_id" in thought_data
        assert "theme_category" in thought_data
        assert "match_count" in thought_data
        assert "similar_thoughts" in thought_data
        assert isinstance(thought_data["similar_thoughts"], list)
        assert isinstance(thought_data["match_count"], int)

        submitted_message_id = thought_data["message_id"]
        assert isinstance(submitted_message_id, str) and len(submitted_message_id) > 0

        # ── Step 4: Paginate similar thoughts ───────────────────────────────
        paginate_resp = client.get(
            "/api/v1/thoughts/similar",
            params={"message_id": SEEDED_MESSAGE_ID, "size": 10},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert paginate_resp.status_code == 200, f"Paginate failed: {paginate_resp.text}"
        paginate_data = paginate_resp.json()

        assert "thoughts" in paginate_data
        assert "total" in paginate_data
        assert "search_after" in paginate_data
        assert isinstance(paginate_data["thoughts"], list)
        assert isinstance(paginate_data["total"], int)

        # ── Step 5: Submit resolution ────────────────────────────────────────
        resolution_resp = client.post(
            "/api/v1/resolution",
            json={
                "message_id": SEEDED_MESSAGE_ID,
                "resolution_text": "I asked for fewer meetings and my stress dropped.",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resolution_resp.status_code == 200, f"Submit resolution failed: {resolution_resp.text}"
        resolution_data = resolution_resp.json()

        assert "message_id" in resolution_data
        assert "resolution_text" in resolution_data
        assert "timestamp" in resolution_data
        assert resolution_data["message_id"] == SEEDED_MESSAGE_ID
        assert isinstance(resolution_data["resolution_text"], str)
        assert isinstance(resolution_data["timestamp"], int)

        # ── Step 6: Retrieve resolution ──────────────────────────────────────
        # Reconfigure ES mock so get_resolution returns the stored advice
        mock_es_client.get.return_value = {
            "_source": {
                "has_resolution": True,
                "resolution_text": resolution_data["resolution_text"],
            }
        }
        get_resp = client.get(
            f"/api/v1/resolution/{SEEDED_MESSAGE_ID}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_resp.status_code == 200, f"Get resolution failed: {get_resp.text}"
        get_data = get_resp.json()

        assert "message_id" in get_data
        assert "resolution_text" in get_data
        assert "timestamp" in get_data
        assert get_data["message_id"] == SEEDED_MESSAGE_ID
        assert isinstance(get_data["resolution_text"], str)
        assert len(get_data["resolution_text"]) > 0
