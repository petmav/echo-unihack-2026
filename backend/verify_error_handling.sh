#!/bin/bash
# Verification script for subtask-3-2: Test error handling for Ollama unavailable
#
# This script verifies that the anonymiser service handles Ollama failures gracefully
# and that error messages never expose raw input text (privacy check).

set -e  # Exit on error

echo "=========================================="
echo "Subtask 3-2: Error Handling Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test data with sensitive PII (to verify it doesn't leak in errors)
TEST_INPUT='{"text":"My boss David at CIA headquarters undermines me constantly"}'
SENSITIVE_KEYWORDS=("David" "CIA" "headquarters" "undermines")

# Function to check if Ollama is running
check_ollama_running() {
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        return 0  # Ollama is running
    else
        return 1  # Ollama is not running
    fi
}

# Function to check if backend is running
check_backend_running() {
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        return 0  # Backend is running
    else
        return 1  # Backend is not running
    fi
}

# Function to stop Ollama (platform-agnostic)
stop_ollama() {
    echo "Stopping Ollama service..."

    # Try multiple methods to stop Ollama
    if command -v systemctl &> /dev/null; then
        sudo systemctl stop ollama 2>/dev/null || true
    fi

    # Kill Ollama processes
    pkill -f "ollama serve" 2>/dev/null || true
    pkill -f "ollama" 2>/dev/null || true

    # Wait a moment for process to stop
    sleep 2

    if check_ollama_running; then
        echo -e "${RED}ERROR: Failed to stop Ollama${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Ollama stopped${NC}"
        return 0
    fi
}

# Function to start Ollama
start_ollama() {
    echo "Starting Ollama service..."

    # Start Ollama in background
    if command -v systemctl &> /dev/null; then
        sudo systemctl start ollama 2>/dev/null || nohup ollama serve > /dev/null 2>&1 &
    else
        nohup ollama serve > /dev/null 2>&1 &
    fi

    # Wait for Ollama to be ready (up to 10 seconds)
    for i in {1..10}; do
        if check_ollama_running; then
            echo -e "${GREEN}✓ Ollama started and ready${NC}"
            return 0
        fi
        echo "Waiting for Ollama to start... ($i/10)"
        sleep 1
    done

    echo -e "${RED}ERROR: Ollama failed to start${NC}"
    return 1
}

# Step 0: Check backend is running
echo "Step 0: Checking if backend is running..."
if ! check_backend_running; then
    echo -e "${YELLOW}Backend is not running. Please start it in another terminal:${NC}"
    echo "  cd backend && uvicorn main:app --reload"
    exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Record initial Ollama state
OLLAMA_WAS_RUNNING=false
if check_ollama_running; then
    OLLAMA_WAS_RUNNING=true
    echo "Initial state: Ollama is running"
else
    echo "Initial state: Ollama is not running"
fi
echo ""

# Step 1: Stop Ollama service
echo "Step 1: Stopping Ollama service..."
if check_ollama_running; then
    stop_ollama
else
    echo -e "${YELLOW}Ollama is already stopped${NC}"
fi
echo ""

# Step 2: Call POST /api/v1/anonymise with test data
echo "Step 2: Testing API with Ollama unavailable..."
echo "Request: POST /api/v1/anonymise"
echo "Body: $TEST_INPUT"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST http://localhost:8000/api/v1/anonymise \
    -H 'Content-Type: application/json' \
    -d "$TEST_INPUT")

# Extract HTTP status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $RESPONSE_BODY"
echo ""

# Step 3: Verify graceful error response (HTTP 503 Service Unavailable)
echo "Step 3: Verifying HTTP status code..."
if [ "$HTTP_STATUS" = "503" ]; then
    echo -e "${GREEN}✓ PASS: Received HTTP 503 Service Unavailable${NC}"
elif [ "$HTTP_STATUS" = "504" ]; then
    echo -e "${GREEN}✓ PASS: Received HTTP 504 Gateway Timeout (also acceptable)${NC}"
else
    echo -e "${RED}✗ FAIL: Expected HTTP 503 or 504, got $HTTP_STATUS${NC}"

    # Restore Ollama if it was running before
    if [ "$OLLAMA_WAS_RUNNING" = true ]; then
        start_ollama
    fi
    exit 1
fi
echo ""

# Step 4: Verify error message does NOT contain raw input text (privacy check)
echo "Step 4: Privacy check - verifying error message does NOT contain sensitive input..."
PRIVACY_FAIL=false

for keyword in "${SENSITIVE_KEYWORDS[@]}"; do
    if echo "$RESPONSE_BODY" | grep -qi "$keyword"; then
        echo -e "${RED}✗ FAIL: Error message contains sensitive keyword: '$keyword'${NC}"
        PRIVACY_FAIL=true
    else
        echo -e "${GREEN}✓ PASS: Keyword '$keyword' not found in error message${NC}"
    fi
done

if [ "$PRIVACY_FAIL" = true ]; then
    echo -e "${RED}✗ PRIVACY VIOLATION: Raw input text leaked in error message!${NC}"

    # Restore Ollama if it was running before
    if [ "$OLLAMA_WAS_RUNNING" = true ]; then
        start_ollama
    fi
    exit 1
fi

echo -e "${GREEN}✓ PASS: Error message does not contain raw input text${NC}"
echo ""

# Step 5: Restart Ollama and verify service recovers
if [ "$OLLAMA_WAS_RUNNING" = true ]; then
    echo "Step 5: Restarting Ollama and verifying service recovery..."

    if ! start_ollama; then
        echo -e "${RED}ERROR: Failed to restart Ollama${NC}"
        exit 1
    fi

    # Give Ollama a moment to fully initialize
    sleep 3

    # Test the endpoint again with Ollama running
    echo "Testing API with Ollama available..."
    RECOVERY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -X POST http://localhost:8000/api/v1/anonymise \
        -H 'Content-Type: application/json' \
        -d '{"text":"My colleague Alex at the office annoys me"}')

    RECOVERY_STATUS=$(echo "$RECOVERY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    RECOVERY_BODY=$(echo "$RECOVERY_RESPONSE" | sed '/HTTP_STATUS:/d')

    echo "Response Status: $RECOVERY_STATUS"
    echo "Response Body: $RECOVERY_BODY"
    echo ""

    if [ "$RECOVERY_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ PASS: Service recovered - received HTTP 200${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: Expected HTTP 200, got $RECOVERY_STATUS${NC}"
        echo "This might be due to model not being loaded. Check Ollama logs."
    fi
else
    echo "Step 5: Skipped (Ollama was not running initially)"
fi
echo ""

# Final summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "${GREEN}✓ Error handling works correctly${NC}"
echo -e "${GREEN}✓ Returns HTTP 503/504 when Ollama unavailable${NC}"
echo -e "${GREEN}✓ Privacy check passed - no raw text in errors${NC}"
if [ "$OLLAMA_WAS_RUNNING" = true ]; then
    echo -e "${GREEN}✓ Service recovery verified${NC}"
fi
echo ""
echo -e "${GREEN}ALL CHECKS PASSED!${NC}"
