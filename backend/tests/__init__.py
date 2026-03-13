"""
Echo Backend Test Suite

This package contains integration and end-to-end tests for the Echo backend services.

PRIVACY TESTING:
All tests must verify that raw thought text is never logged, cached, or persisted.
Tests should validate error messages do not expose raw input text.

Test categories:
- Anonymiser integration tests: Verify Ollama integration and PII stripping
- Error handling tests: Verify graceful degradation when services are unavailable
- Performance tests: Verify response times meet acceptance criteria (< 2 seconds)
"""
