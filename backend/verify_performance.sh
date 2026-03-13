#!/bin/bash

# Performance Verification Script for Echo Anonymiser Service
# This script verifies subtask-3-3: Performance requirements (< 2 seconds)

set -e  # Exit on error

echo "=============================================================================="
echo "Echo Anonymiser Service - Performance Verification"
echo "Subtask 3-3: Verify performance requirements (< 2 seconds)"
echo "=============================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if Ollama is running
echo -e "\n${YELLOW}[1/5] Checking Ollama service...${NC}"
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

# Step 2: Check if the anonymizer model is available
echo -e "\n${YELLOW}[2/5] Checking anonymizer model availability...${NC}"
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

# Step 3: Check if backend dependencies are installed
echo -e "\n${YELLOW}[3/5] Checking Python dependencies...${NC}"
cd "$(dirname "$0")"
if python -c "import pytest; import httpx; import fastapi" 2>/dev/null; then
    echo -e "${GREEN}✓ Dependencies are installed${NC}"
else
    echo -e "${RED}✗ Dependencies missing${NC}"
    echo ""
    echo "Please install dependencies with:"
    echo "  cd backend && pip install -r requirements.txt"
    echo ""
    exit 1
fi

# Step 4: Run pytest performance tests
echo -e "\n${YELLOW}[4/5] Running pytest performance tests...${NC}"
echo ""

# Run the performance tests with verbose output
if pytest tests/test_performance.py -v -s; then
    echo -e "\n${GREEN}✓ All pytest performance tests passed${NC}"
    PYTEST_RESULT=0
else
    echo -e "\n${RED}✗ Some pytest performance tests failed${NC}"
    PYTEST_RESULT=1
fi

# Step 5: Run standalone performance test
echo -e "\n${YELLOW}[5/5] Running standalone performance test...${NC}"
echo ""

if python tests/test_performance.py; then
    echo -e "\n${GREEN}✓ Standalone performance test passed${NC}"
    STANDALONE_RESULT=0
else
    echo -e "\n${RED}✗ Standalone performance test failed${NC}"
    STANDALONE_RESULT=1
fi

# Final summary
echo ""
echo "=============================================================================="
echo "VERIFICATION SUMMARY"
echo "=============================================================================="

if [ $PYTEST_RESULT -eq 0 ] && [ $STANDALONE_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ SUCCESS: All performance tests passed${NC}"
    echo ""
    echo "Performance requirements verified:"
    echo "  ✓ All requests complete within 2 seconds"
    echo "  ✓ Performance baseline recorded"
    echo "  ✓ Consistent performance across multiple requests"
    echo ""
    echo "Subtask 3-3 can be marked as COMPLETED."
    echo "=============================================================================="
    exit 0
else
    echo -e "${RED}✗ FAILURE: Some performance tests failed${NC}"
    echo ""
    echo "Please review the test output above for details."
    echo ""
    echo "Common issues:"
    echo "  - Ollama model may need optimization"
    echo "  - System resources may be constrained"
    echo "  - Network latency to Ollama service"
    echo ""
    echo "Subtask 3-3 should NOT be marked as completed until all tests pass."
    echo "=============================================================================="
    exit 1
fi
