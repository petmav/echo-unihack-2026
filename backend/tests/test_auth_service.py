"""
Unit tests for the authentication service.

Tests cover:
- hash_password: returns a bcrypt hash string
- verify_password: correct/incorrect password verification
- create_access_token: returns a valid 3-part JWT string
- decode_access_token: valid token, expired token, tampered token, None/empty input
"""

from datetime import UTC, datetime, timedelta

from jose import jwt

from config import config
from services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_USER_ID = "550e8400-e29b-41d4-a716-446655440000"
SAMPLE_PASSWORD = "SuperSecretP@ssw0rd!"


# ---------------------------------------------------------------------------
# hash_password tests
# ---------------------------------------------------------------------------

class TestHashPassword:
    """Tests for hash_password()."""

    def test_returns_bcrypt_string(self):
        """hash_password must return a bcrypt hash starting with $2b$."""
        hashed = hash_password(SAMPLE_PASSWORD)
        assert isinstance(hashed, str)
        assert hashed.startswith("$2b$"), (
            f"Expected bcrypt hash starting with '$2b$', got: {hashed[:10]}..."
        )

    def test_hash_is_different_from_plain_password(self):
        """The hash must not be the same as the plain text password."""
        hashed = hash_password(SAMPLE_PASSWORD)
        assert hashed != SAMPLE_PASSWORD

    def test_two_hashes_of_same_password_differ(self):
        """Each call should produce a unique hash (different salts)."""
        hash_1 = hash_password(SAMPLE_PASSWORD)
        hash_2 = hash_password(SAMPLE_PASSWORD)
        assert hash_1 != hash_2, "bcrypt should produce unique hashes per call due to random salt"

    def test_hash_has_expected_bcrypt_cost_factor(self):
        """Hash should contain cost factor 12 as configured."""
        hashed = hash_password(SAMPLE_PASSWORD)
        # bcrypt format: $2b$<cost>$...
        parts = hashed.split("$")
        assert parts[2] == "12", f"Expected cost factor 12, got: {parts[2]}"


# ---------------------------------------------------------------------------
# verify_password tests
# ---------------------------------------------------------------------------

class TestVerifyPassword:
    """Tests for verify_password()."""

    def test_correct_password_returns_true(self):
        """verify_password must return True when the password matches the hash."""
        hashed = hash_password(SAMPLE_PASSWORD)
        result = verify_password(SAMPLE_PASSWORD, hashed)
        assert result is True

    def test_wrong_password_returns_false(self):
        """verify_password must return False when the password does not match."""
        hashed = hash_password(SAMPLE_PASSWORD)
        result = verify_password("WrongPassword123!", hashed)
        assert result is False

    def test_empty_string_password_returns_false(self):
        """verify_password must return False for an empty string against a real hash."""
        hashed = hash_password(SAMPLE_PASSWORD)
        result = verify_password("", hashed)
        assert result is False

    def test_case_sensitive_verification(self):
        """verify_password must be case-sensitive."""
        hashed = hash_password(SAMPLE_PASSWORD)
        result = verify_password(SAMPLE_PASSWORD.lower(), hashed)
        assert result is False


# ---------------------------------------------------------------------------
# create_access_token tests
# ---------------------------------------------------------------------------

class TestCreateAccessToken:
    """Tests for create_access_token()."""

    def test_returns_string(self):
        """create_access_token must return a string."""
        token = create_access_token(SAMPLE_USER_ID)
        assert isinstance(token, str)

    def test_token_has_three_dot_separated_parts(self):
        """JWT must have exactly three dot-separated parts: header.payload.signature."""
        token = create_access_token(SAMPLE_USER_ID)
        parts = token.split(".")
        assert len(parts) == 3, (
            f"Expected JWT with 3 dot-separated parts, got {len(parts)}: {token}"
        )

    def test_token_contains_user_id_as_subject(self):
        """The token payload must contain the user_id as 'sub'."""
        token = create_access_token(SAMPLE_USER_ID)
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        assert payload["sub"] == SAMPLE_USER_ID

    def test_token_contains_expiry(self):
        """The token payload must contain an 'exp' claim."""
        token = create_access_token(SAMPLE_USER_ID)
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        assert "exp" in payload

    def test_token_contains_issued_at(self):
        """The token payload must contain an 'iat' claim."""
        token = create_access_token(SAMPLE_USER_ID)
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        assert "iat" in payload

    def test_token_payload_has_no_sensitive_data(self):
        """JWT payload must NOT contain email, password, or other sensitive fields."""
        token = create_access_token(SAMPLE_USER_ID)
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        forbidden_keys = {"email", "password", "ip_address", "device_id", "name"}
        present_forbidden = forbidden_keys.intersection(set(payload.keys()))
        assert not present_forbidden, (
            f"JWT payload contains forbidden sensitive keys: {present_forbidden}"
        )


# ---------------------------------------------------------------------------
# decode_access_token tests
# ---------------------------------------------------------------------------

class TestDecodeAccessToken:
    """Tests for decode_access_token()."""

    def test_valid_token_returns_user_id(self):
        """decode_access_token must return the user_id string for a valid token."""
        token = create_access_token(SAMPLE_USER_ID)
        result = decode_access_token(token)
        assert result == SAMPLE_USER_ID

    def test_expired_token_returns_none(self):
        """decode_access_token must return None for an expired token."""
        now = datetime.now(UTC)
        payload = {
            "sub": SAMPLE_USER_ID,
            "iat": now - timedelta(days=8),
            "exp": now - timedelta(seconds=1),  # already expired
        }
        expired_token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
        result = decode_access_token(expired_token)
        assert result is None

    def test_tampered_token_returns_none(self):
        """decode_access_token must return None for a token with an invalid signature."""
        token = create_access_token(SAMPLE_USER_ID)
        # Tamper by replacing the last character of the signature
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        result = decode_access_token(tampered)
        assert result is None

    def test_none_input_returns_none(self):
        """decode_access_token must return None when given None."""
        result = decode_access_token(None)
        assert result is None

    def test_empty_string_returns_none(self):
        """decode_access_token must return None for an empty string."""
        result = decode_access_token("")
        assert result is None

    def test_garbage_string_returns_none(self):
        """decode_access_token must return None for a completely invalid token string."""
        result = decode_access_token("not.a.jwt.token.at.all")
        assert result is None

    def test_wrong_secret_returns_none(self):
        """decode_access_token must return None if the token was signed with a different secret."""
        payload = {
            "sub": SAMPLE_USER_ID,
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(days=7),
        }
        wrong_secret_token = jwt.encode(payload, "wrong-secret", algorithm=config.JWT_ALGORITHM)
        result = decode_access_token(wrong_secret_token)
        assert result is None
