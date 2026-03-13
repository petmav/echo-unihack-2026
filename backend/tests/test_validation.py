"""
Unit tests for Pydantic model validation.

Tests cover:
- ThoughtSubmitRequest: min_length, max_length=1000, whitespace normalisation
- AuthCredentials: email format validation, password length constraints
- ResolutionSubmit: min_length, max_length=1000, whitespace normalisation

No external dependencies required — pure Pydantic validation tests.
"""

import pytest
from pydantic import ValidationError

from models.auth import AuthCredentials
from models.resolution import ResolutionSubmit
from models.thought import ThoughtSubmitRequest

# ---------------------------------------------------------------------------
# ThoughtSubmitRequest
# ---------------------------------------------------------------------------

class TestThoughtSubmitRequest:
    """Tests for ThoughtSubmitRequest validation."""

    def test_valid_thought(self):
        """A normal thought within bounds should parse successfully."""
        req = ThoughtSubmitRequest(text="I feel overwhelmed at work.")
        assert req.text == "I feel overwhelmed at work."

    def test_min_length_rejects_empty_string(self):
        """Empty string must be rejected (min_length=1)."""
        with pytest.raises(ValidationError) as exc_info:
            ThoughtSubmitRequest(text="")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("text",) for e in errors)

    def test_whitespace_only_normalises_to_empty_string(self):
        """
        Whitespace-only input passes Field min_length (raw length > 0) then
        collapses to '' after strip_whitespace normalisation.
        The model accepts the input; the empty result is the caller's responsibility to handle.
        """
        req = ThoughtSubmitRequest(text="   ")
        assert req.text == ""

    def test_max_length_accepts_exactly_1000_chars(self):
        """A string of exactly 1000 characters must be accepted."""
        text = "a" * 1000
        req = ThoughtSubmitRequest(text=text)
        assert len(req.text) == 1000

    def test_max_length_rejects_1001_chars(self):
        """A string of 1001 characters must be rejected (max_length=1000)."""
        text = "a" * 1001
        with pytest.raises(ValidationError) as exc_info:
            ThoughtSubmitRequest(text=text)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("text",) for e in errors)

    def test_whitespace_normalisation_strips_leading_trailing(self):
        """Leading and trailing whitespace should be stripped."""
        req = ThoughtSubmitRequest(text="  hello world  ")
        assert req.text == "hello world"

    def test_whitespace_normalisation_collapses_internal_spaces(self):
        """Multiple internal spaces should be collapsed to single spaces."""
        req = ThoughtSubmitRequest(text="hello   world  today")
        assert req.text == "hello world today"

    def test_whitespace_normalisation_handles_newlines(self):
        """Newlines and tabs in the middle are treated as whitespace and collapsed."""
        req = ThoughtSubmitRequest(text="line one\nline two\ttab")
        assert req.text == "line one line two tab"

    def test_single_character_thought_accepted(self):
        """Single non-whitespace character is the minimum valid input."""
        req = ThoughtSubmitRequest(text="?")
        assert req.text == "?"

    def test_text_field_required(self):
        """Omitting text should raise ValidationError."""
        with pytest.raises(ValidationError):
            ThoughtSubmitRequest()

    def test_unicode_content_accepted(self):
        """Unicode characters (emoji, accented letters) should be accepted."""
        req = ThoughtSubmitRequest(text="Je suis épuisé 😔")
        assert "épuisé" in req.text


# ---------------------------------------------------------------------------
# AuthCredentials
# ---------------------------------------------------------------------------

class TestAuthCredentials:
    """Tests for AuthCredentials validation."""

    def test_valid_credentials(self):
        """Standard email and 8-char password must be accepted."""
        creds = AuthCredentials(email="user@example.com", password="securepa")
        assert creds.email == "user@example.com"
        assert creds.password == "securepa"

    def test_email_normalised_to_lowercase(self):
        """Email should be lower-cased during validation."""
        creds = AuthCredentials(email="User@EXAMPLE.COM", password="password1")
        assert creds.email == "user@example.com"

    def test_email_strips_surrounding_whitespace(self):
        """Leading/trailing whitespace around email should be stripped."""
        creds = AuthCredentials(email="  user@example.com  ", password="password1")
        assert creds.email == "user@example.com"

    def test_email_missing_at_sign_rejected(self):
        """Email without @ must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AuthCredentials(email="userexample.com", password="password1")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("email",) for e in errors)

    def test_email_missing_domain_rejected(self):
        """Email with no domain after @ must be rejected."""
        with pytest.raises(ValidationError):
            AuthCredentials(email="user@", password="password1")

    def test_email_missing_tld_rejected(self):
        """Email without a TLD (e.g. no dot after domain name) must be rejected."""
        with pytest.raises(ValidationError):
            AuthCredentials(email="user@nodot", password="password1")

    def test_email_accepts_subdomain(self):
        """Email with subdomain should be valid."""
        creds = AuthCredentials(email="user@mail.example.com", password="password1")
        assert "mail.example.com" in creds.email

    def test_email_accepts_plus_addressing(self):
        """Email with + in local part should be valid."""
        creds = AuthCredentials(email="user+tag@example.com", password="password1")
        assert "user+tag" in creds.email

    def test_password_min_length_exactly_8(self):
        """Password of exactly 8 characters must be accepted."""
        creds = AuthCredentials(email="a@b.co", password="12345678")
        assert len(creds.password) == 8

    def test_password_min_length_7_rejected(self):
        """Password shorter than 8 characters must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AuthCredentials(email="a@b.co", password="1234567")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("password",) for e in errors)

    def test_password_max_length_exactly_128(self):
        """Password of exactly 128 characters must be accepted."""
        creds = AuthCredentials(email="a@b.co", password="x" * 128)
        assert len(creds.password) == 128

    def test_password_max_length_129_rejected(self):
        """Password of 129 characters must be rejected (max_length=128)."""
        with pytest.raises(ValidationError) as exc_info:
            AuthCredentials(email="a@b.co", password="x" * 129)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("password",) for e in errors)

    def test_email_field_required(self):
        """Omitting email should raise ValidationError."""
        with pytest.raises(ValidationError):
            AuthCredentials(password="password1")

    def test_password_field_required(self):
        """Omitting password should raise ValidationError."""
        with pytest.raises(ValidationError):
            AuthCredentials(email="user@example.com")

    def test_empty_email_rejected(self):
        """Empty string email must be rejected."""
        with pytest.raises(ValidationError):
            AuthCredentials(email="", password="password1")

    def test_empty_password_rejected(self):
        """Empty string password must be rejected (min_length=8)."""
        with pytest.raises(ValidationError):
            AuthCredentials(email="a@b.co", password="")


# ---------------------------------------------------------------------------
# ResolutionSubmit
# ---------------------------------------------------------------------------

class TestResolutionSubmit:
    """Tests for ResolutionSubmit validation."""

    def test_valid_resolution(self):
        """A valid message_id and resolution_text should parse successfully."""
        res = ResolutionSubmit(
            message_id="msg-abc123",
            resolution_text="Talking to a therapist really helped me."
        )
        assert res.message_id == "msg-abc123"
        assert res.resolution_text == "Talking to a therapist really helped me."

    def test_resolution_text_min_length_rejects_empty(self):
        """Empty resolution_text must be rejected (min_length=1)."""
        with pytest.raises(ValidationError) as exc_info:
            ResolutionSubmit(message_id="msg-1", resolution_text="")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("resolution_text",) for e in errors)

    def test_resolution_text_whitespace_only_normalises_to_empty(self):
        """
        Whitespace-only input passes Field min_length (raw length > 0) then
        collapses to '' after strip_whitespace normalisation.
        The model accepts the input; the empty result is the caller's responsibility to handle.
        """
        res = ResolutionSubmit(message_id="msg-1", resolution_text="   ")
        assert res.resolution_text == ""

    def test_resolution_text_max_length_accepts_exactly_1000(self):
        """Exactly 1000 characters must be accepted."""
        res = ResolutionSubmit(message_id="msg-1", resolution_text="b" * 1000)
        assert len(res.resolution_text) == 1000

    def test_resolution_text_max_length_rejects_1001(self):
        """1001 characters must be rejected (max_length=1000)."""
        with pytest.raises(ValidationError) as exc_info:
            ResolutionSubmit(message_id="msg-1", resolution_text="b" * 1001)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("resolution_text",) for e in errors)

    def test_resolution_text_whitespace_normalisation(self):
        """Internal and surrounding whitespace should be normalised."""
        res = ResolutionSubmit(
            message_id="msg-1",
            resolution_text="  journaling   every  day  helped  "
        )
        assert res.resolution_text == "journaling every day helped"

    def test_resolution_text_normalises_newlines(self):
        """Newlines in resolution_text should be collapsed to spaces."""
        res = ResolutionSubmit(
            message_id="msg-1",
            resolution_text="First step\nSecond step"
        )
        assert res.resolution_text == "First step Second step"

    def test_message_id_field_required(self):
        """Omitting message_id should raise ValidationError."""
        with pytest.raises(ValidationError):
            ResolutionSubmit(resolution_text="It helped.")

    def test_resolution_text_field_required(self):
        """Omitting resolution_text should raise ValidationError."""
        with pytest.raises(ValidationError):
            ResolutionSubmit(message_id="msg-1")

    def test_single_char_resolution_accepted(self):
        """Single non-whitespace character is valid."""
        res = ResolutionSubmit(message_id="msg-1", resolution_text="!")
        assert res.resolution_text == "!"

    def test_unicode_resolution_text_accepted(self):
        """Unicode content in resolution_text should be accepted."""
        res = ResolutionSubmit(
            message_id="msg-1",
            resolution_text="Méditation quotidienne m'a aidé 🙏"
        )
        assert "Méditation" in res.resolution_text
