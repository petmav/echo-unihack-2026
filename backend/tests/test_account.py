"""
Tests for DELETE /api/v1/account endpoint.

Verifies account deletion behaviour:
- Successful deletion with a valid JWT returns 200 with {deleted: true}
- Missing Authorization header returns 401
- Malformed Authorization header (no "Bearer " prefix) returns 401
- Invalid or expired token returns 401
- Response structure is correct
- Account row is removed from the database after deletion
- MessageTheme rows are removed from the database after deletion
"""

import os
os.environ.setdefault("USE_SQLITE", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, Account, MessageTheme, get_db
from services import auth as auth_service


@pytest.fixture
def db_session():
    """Create an in-memory SQLite session per test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db_session):
    """Test client with DB dependency overridden to in-memory SQLite."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_auth_header(user_id: str) -> str:
    """Create a valid Authorization header value for a given user_id."""
    token = auth_service.create_access_token(user_id)
    return f"Bearer {token}"


class TestDeleteAccount:
    """Tests for the DELETE /api/v1/account endpoint."""

    def test_delete_account_success(self, client, db_session):
        """Valid JWT returns 200 with deleted=True and the correct user_id."""
        user_id = "test-user-uuid-1234"
        account = Account(id=user_id, email="success@example.com", password_hash="hash")
        db_session.add(account)
        db_session.commit()

        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": make_auth_header(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True
        assert data["user_id"] == user_id

    def test_delete_account_missing_auth_header(self, client, db_session):
        """Request without Authorization header returns 401."""
        response = client.delete("/api/v1/account")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_delete_account_no_bearer_prefix(self, client, db_session):
        """Authorization header without 'Bearer ' prefix returns 401."""
        token = auth_service.create_access_token("some-user")
        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": token},  # raw token, no "Bearer " prefix
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_delete_account_invalid_token(self, client, db_session):
        """Completely invalid JWT string returns 401."""
        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_delete_account_expired_token(self, client, db_session):
        """An expired JWT token returns 401."""
        import jwt
        from datetime import datetime, timezone
        from config import config

        # Craft a token that is already expired
        payload = {
            "sub": "expired-user-id",
            "iat": datetime(2020, 1, 1, tzinfo=timezone.utc),
            "exp": datetime(2020, 1, 8, tzinfo=timezone.utc),  # expired long ago
        }
        expired_token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)

        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_delete_account_empty_bearer(self, client, db_session):
        """'Bearer ' with an empty token string returns 401."""
        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": "Bearer "},
        )
        assert response.status_code == 401

    def test_delete_account_response_structure(self, client, db_session):
        """Successful deletion response contains exactly the expected keys."""
        user_id = "structure-check-user"
        account = Account(id=user_id, email="structure@example.com", password_hash="hash")
        db_session.add(account)
        db_session.commit()

        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": make_auth_header(user_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert "deleted" in data
        assert "user_id" in data
        assert data["deleted"] is True

    def test_delete_account_different_users(self, client, db_session):
        """Each user's token returns their own user_id in the response."""
        for uid in ["user-aaa", "user-bbb", "user-ccc"]:
            account = Account(id=uid, email=f"{uid}@example.com", password_hash="hash")
            db_session.add(account)
        db_session.commit()

        for uid in ["user-aaa", "user-bbb", "user-ccc"]:
            response = client.delete(
                "/api/v1/account",
                headers={"Authorization": make_auth_header(uid)},
            )
            assert response.status_code == 200
            assert response.json()["user_id"] == uid

    def test_delete_removes_account_from_db(self, client, db_session):
        """After DELETE, the Account row is no longer in the database."""
        user_id = "db-test-user"
        account = Account(id=user_id, email="dbtest@example.com", password_hash="hash")
        db_session.add(account)
        db_session.commit()

        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": make_auth_header(user_id)},
        )
        assert response.status_code == 200

        assert db_session.query(Account).filter(Account.id == user_id).first() is None

    def test_delete_removes_message_themes(self, client, db_session):
        """After DELETE, all MessageTheme rows for the user are removed from the database."""
        user_id = "db-theme-user"
        account = Account(id=user_id, email="theme@example.com", password_hash="hash")
        theme1 = MessageTheme(account_id=user_id, message_id="msg-1", theme_category="anxiety")
        theme2 = MessageTheme(account_id=user_id, message_id="msg-2", theme_category="stress")
        db_session.add_all([account, theme1, theme2])
        db_session.commit()

        response = client.delete(
            "/api/v1/account",
            headers={"Authorization": make_auth_header(user_id)},
        )
        assert response.status_code == 200

        assert db_session.query(MessageTheme).filter(MessageTheme.account_id == user_id).count() == 0
