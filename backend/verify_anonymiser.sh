#!/bin/bash

# Anonymiser Integration Verification Script
# This script verifies that Ollama is running, the model is available,
# and the anonymiser endpoint works end-to-end.

set -e  # Exit on any error

echo "========================================"
echo "Anonymiser Integration Verification"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if Ollama is running
echo "Step 1: Checking if Ollama is running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is running${NC}"
else
    echo -e "${RED}✗ Ollama is not running${NC}"
    echo ""
    echo "Please start Ollama with:"
    echo "  ollama serve"
    echo ""
    exit 1
fi

echo ""

# Step 2: Check if the anonymizer model is available
echo "Step 2: Checking if anonymizer model is available..."
if curl -s http://localhost:11434/api/tags | grep -q "anonymizer"; then
    echo -e "${GREEN}✓ Anonymizer model is available${NC}"
else
    echo -e "${RED}✗ Anonymizer model not found${NC}"
    echo ""
    echo "Please pull the model with:"
    echo "  ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf"
    echo ""
    exit 1
fi

echo ""

# Step 3: List available models for verification
echo "Step 3: Listing available Ollama models..."
curl -s http://localhost:11434/api/tags | grep -i "name" | head -5
echo ""

# Step 4: Check if backend is running
echo "Step 4: Checking if backend is running..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${YELLOW}⚠ Backend is not running${NC}"
    echo ""
    echo "Starting backend server in background..."
    echo "(You can also start it manually with: cd backend && uvicorn main:app --reload)"
    echo ""

    # Start backend in background
    cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/echo-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"

    # Wait for backend to be ready
    echo "Waiting for backend to start..."
    for i in {1..10}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is ready${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done

    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${RED}✗ Backend failed to start${NC}"
        echo "Check logs at: /tmp/echo-backend.log"
        exit 1
    fi
fi

echo ""

# Step 5: Test the anonymisation endpoint
echo "Step 5: Testing anonymisation endpoint..."
echo "Input: 'My boss David at Google undermines me'"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/anonymise \
    -H 'Content-Type: application/json' \
    -d '{"text":"My boss David at Google undermines me"}')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Step 6: Verify response contains anonymised placeholders
echo "Step 6: Verifying anonymised output..."

if echo "$RESPONSE" | grep -q "anonymised_text"; then
    echo -e "${GREEN}✓ Response has correct structure${NC}"

    # Extract anonymised text
    ANONYMISED_TEXT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('anonymised_text', ''))" 2>/dev/null || echo "")

    if [ -n "$ANONYMISED_TEXT" ]; then
        echo -e "${GREEN}✓ Anonymised text extracted:${NC}"
        echo "  $ANONYMISED_TEXT"
        echo ""

        # Check for placeholders
        if echo "$ANONYMISED_TEXT" | grep -q "\["; then
            echo -e "${GREEN}✓ Contains placeholders (e.g., [male name], [tech company])${NC}"
        else
            echo -e "${YELLOW}⚠ May not contain expected placeholders${NC}"
        fi

        # Verify original PII is removed
        if echo "$ANONYMISED_TEXT" | grep -qi "David"; then
            echo -e "${RED}✗ WARNING: Original name 'David' still present${NC}"
        else
            echo -e "${GREEN}✓ Original name 'David' removed${NC}"
        fi

        if echo "$ANONYMISED_TEXT" | grep -qi "Google"; then
            echo -e "${RED}✗ WARNING: Original company 'Google' still present${NC}"
        else
            echo -e "${GREEN}✓ Original company 'Google' removed${NC}"
        fi
    else
        echo -e "${RED}✗ Failed to extract anonymised text${NC}"
    fi
else
    echo -e "${RED}✗ Response does not have expected structure${NC}"
    echo "Expected: {\"anonymised_text\": \"...\"}"
fi

echo ""
echo "========================================"
echo "Verification Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Review the test results above"
echo "2. Run integration tests: cd backend && pytest tests/test_anonymiser.py -v"
echo "3. If backend was started by this script, stop it with: kill $BACKEND_PID"
echo ""
