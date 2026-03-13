#!/bin/bash
# End-to-end Auth Flow Verification Script

set -e  # Exit on error

BASE_URL="http://127.0.0.1:8000/api/v1"
TEST_EMAIL="e2e-test-$(date +%s)@example.com"
TEST_PASSWORD="testpassword123"

echo "=== Echo Auth E2E Verification ==="
echo ""

# Step 1: Register new account
echo "Step 1: Register new account..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Response: $REGISTER_RESPONSE"

# Extract token from response
REGISTER_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$REGISTER_TOKEN" ]; then
  echo "❌ FAILED: No access token received from registration"
  exit 1
fi

echo "✅ Registration successful - Token received: ${REGISTER_TOKEN:0:20}..."
echo ""

# Step 2: Verify JWT token format
echo "Step 2: Verify JWT token format..."
TOKEN_PARTS=$(echo $REGISTER_TOKEN | tr '.' '\n' | wc -l)

if [ $TOKEN_PARTS -ne 3 ]; then
  echo "❌ FAILED: Invalid JWT format (expected 3 parts, got $TOKEN_PARTS)"
  exit 1
fi

echo "✅ JWT token format valid (3 parts: header.payload.signature)"
echo ""

# Step 3: Login with same credentials
echo "Step 3: Login with same credentials..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Response: $LOGIN_RESPONSE"

LOGIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$LOGIN_TOKEN" ]; then
  echo "❌ FAILED: No access token received from login"
  exit 1
fi

echo "✅ Login successful - Token received: ${LOGIN_TOKEN:0:20}..."
echo ""

# Step 4: Test login with wrong password
echo "Step 4: Test login with wrong password..."
WRONG_LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpassword\"}")

WRONG_STATUS=$(echo "$WRONG_LOGIN_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$WRONG_STATUS" != "401" ]; then
  echo "❌ FAILED: Wrong password should return 401, got $WRONG_STATUS"
  exit 1
fi

echo "✅ Invalid password correctly rejected (401 Unauthorized)"
echo ""

# Step 5: Refresh token
echo "Step 5: Refresh token..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Authorization: Bearer $LOGIN_TOKEN")

echo "Response: $REFRESH_RESPONSE"

REFRESH_TOKEN=$(echo $REFRESH_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$REFRESH_TOKEN" ]; then
  echo "❌ FAILED: No access token received from refresh"
  exit 1
fi

echo "✅ Token refresh successful - New token: ${REFRESH_TOKEN:0:20}..."
echo ""

# Step 6: Test protected endpoint with valid token
echo "Step 6: Test protected endpoint (DELETE /account/) with valid token..."
DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "$BASE_URL/account/" \
  -H "Authorization: Bearer $REFRESH_TOKEN")

DELETE_STATUS=$(echo "$DELETE_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
DELETE_BODY=$(echo "$DELETE_RESPONSE" | grep -v HTTP_STATUS)

if [ "$DELETE_STATUS" != "200" ]; then
  echo "❌ FAILED: Account deletion should return 200, got $DELETE_STATUS"
  echo "Response: $DELETE_BODY"
  exit 1
fi

echo "Response: $DELETE_BODY"
echo "✅ Account deletion successful (200 OK)"
echo ""

# Step 7: Verify account is deleted (login should fail)
echo "Step 7: Verify account is deleted from database..."
VERIFY_DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

VERIFY_STATUS=$(echo "$VERIFY_DELETE_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$VERIFY_STATUS" != "401" ]; then
  echo "❌ FAILED: Login with deleted account should return 401, got $VERIFY_STATUS"
  exit 1
fi

echo "✅ Account deletion verified - Login fails with 401"
echo ""

# Step 8: Test password validation (minimum 8 characters)
echo "Step 8: Test password validation (minimum 8 characters)..."
SHORT_PASS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"short@example.com\",\"password\":\"short\"}")

SHORT_PASS_STATUS=$(echo "$SHORT_PASS_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$SHORT_PASS_STATUS" != "422" ]; then
  echo "❌ FAILED: Short password should return 422 validation error, got $SHORT_PASS_STATUS"
  exit 1
fi

echo "✅ Password validation working - Short passwords rejected (422)"
echo ""

# Step 9: Test duplicate email registration
echo "Step 9: Test duplicate email registration..."
# First register a new account
DUP_EMAIL="duplicate-test@example.com"
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DUP_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null

# Try to register again with same email
DUP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DUP_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

DUP_STATUS=$(echo "$DUP_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$DUP_STATUS" != "400" ]; then
  echo "❌ FAILED: Duplicate email should return 400, got $DUP_STATUS"
  exit 1
fi

echo "✅ Duplicate email correctly rejected (400 Bad Request)"
echo ""

# Step 10: Test protected endpoint without auth
echo "Step 10: Test protected endpoint without authentication..."
NO_AUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "$BASE_URL/account/")

NO_AUTH_STATUS=$(echo "$NO_AUTH_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$NO_AUTH_STATUS" != "403" ]; then
  echo "❌ FAILED: Protected endpoint without auth should return 403, got $NO_AUTH_STATUS"
  exit 1
fi

echo "✅ Protected endpoint requires authentication (403 Forbidden)"
echo ""

# All tests passed!
echo "========================================="
echo "✅ ALL E2E AUTH TESTS PASSED!"
echo "========================================="
echo ""
echo "Verified:"
echo "  ✓ User registration with email + password"
echo "  ✓ JWT token generation and format"
echo "  ✓ User login with credentials"
echo "  ✓ Invalid password rejection"
echo "  ✓ Token refresh flow"
echo "  ✓ Protected endpoint access with auth"
echo "  ✓ Account deletion"
echo "  ✓ Account deletion verification"
echo "  ✓ Password minimum length validation (8 chars)"
echo "  ✓ Duplicate email rejection"
echo "  ✓ Protected endpoint auth requirement"
echo ""
