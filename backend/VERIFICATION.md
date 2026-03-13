# Anonymiser Service Verification Guide

This guide walks through the end-to-end verification of the anonymiser service integration with Ollama.

## Prerequisites

Before running the verification, ensure you have:

1. **Ollama installed and running**
   ```bash
   ollama serve
   ```

2. **Anonymizer model pulled**
   ```bash
   ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
   ```

3. **Python dependencies installed**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

## Automated Verification

Run the automated verification script:

```bash
cd backend
./verify_anonymiser.sh
```

This script will:
- ✅ Check if Ollama is running
- ✅ Verify the anonymizer model is available
- ✅ Start the backend (if not already running)
- ✅ Test the anonymisation endpoint
- ✅ Verify PII is replaced with placeholders

## Manual Verification

If you prefer to run verification steps manually:

### Step 1: Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

Expected output: JSON response with list of models

### Step 2: Verify Model Availability

```bash
curl http://localhost:11434/api/tags | grep anonymizer
```

Expected output: Should show the anonymizer model in the list

### Step 3: Start Backend Server

```bash
cd backend
uvicorn main:app --reload
```

Expected output: Server starts on http://localhost:8000

### Step 4: Test Health Endpoint

```bash
curl http://localhost:8000/health
```

Expected output:
```json
{
  "status": "healthy",
  "service": "echo-backend",
  "version": "1.0.0"
}
```

### Step 5: Test Anonymisation Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/anonymise \
  -H 'Content-Type: application/json' \
  -d '{"text":"My boss David at Google undermines me"}'
```

Expected output:
```json
{
  "anonymised_text": "My [male name] at [tech company] undermines me"
}
```

### Step 6: Verify PII Replacement

Check that the response:
- ✅ Contains placeholders like `[male name]`, `[tech company]`
- ✅ Does NOT contain "David" or "Google"
- ✅ Preserves emotional context ("undermines me")

## Integration Tests

Run the pytest integration tests:

```bash
cd backend
pytest tests/test_anonymiser.py -v
```

This will run:
- **Connection tests**: Verify Ollama is reachable
- **Model availability tests**: Verify anonymizer model is loaded
- **Anonymisation tests**: Test PII replacement with various inputs
- **Performance tests**: Verify response time < 2 seconds
- **Error handling tests**: Verify graceful degradation when Ollama is unavailable
- **Privacy tests**: Verify raw text is never logged

## Expected Test Results

All tests should PASS:

```
tests/test_anonymiser.py::TestAnonymiserServiceIntegration::test_ollama_connection PASSED
tests/test_anonymiser.py::TestAnonymiserServiceIntegration::test_model_availability PASSED
tests/test_anonymiser.py::TestAnonymiserServiceIntegration::test_anonymise_basic PASSED
tests/test_anonymiser.py::TestAnonymiserServiceIntegration::test_anonymise_preserves_emotional_content PASSED
tests/test_anonymiser.py::TestAnonymiserServiceIntegration::test_anonymise_performance PASSED
tests/test_anonymiser.py::TestAnonymiserServiceErrorHandling::test_connection_error_when_ollama_unavailable PASSED
tests/test_anonymiser.py::TestAnonymiserServiceErrorHandling::test_error_messages_do_not_contain_raw_text PASSED
tests/test_anonymiser.py::TestAnonymiserServicePrivacy::test_no_raw_text_in_logs PASSED
```

## Troubleshooting

### Ollama Not Running

**Error**: `curl: (7) Failed to connect to localhost port 11434`

**Solution**:
```bash
ollama serve
```

### Model Not Available

**Error**: No "anonymizer" in model list

**Solution**:
```bash
ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
```

### Backend Connection Error (503)

**Error**: `{"detail":"Anonymizer service unavailable"}`

**Cause**: Ollama is not running

**Solution**: Start Ollama with `ollama serve`

### Backend Timeout Error (504)

**Error**: `{"detail":"Anonymization request timed out"}`

**Cause**: Model is taking too long to respond (> 2 seconds)

**Solutions**:
1. Check Ollama is not overloaded
2. Try a smaller input text
3. Restart Ollama service

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'pytest'`

**Solution**:
```bash
cd backend
pip install -r requirements.txt
```

## Privacy Verification

**CRITICAL**: Verify that raw thought text is NEVER logged:

```bash
cd backend
grep -r "log.*text\|print.*text\|logger.*text" services/anonymiser.py || echo "PASS: No raw text logging found"
```

Expected output: `PASS: No raw text logging found`

## Performance Baseline

Measure anonymisation performance:

```bash
time curl -X POST http://localhost:8000/api/v1/anonymise \
  -H 'Content-Type: application/json' \
  -d '{"text":"My boss David at Google undermines me"}'
```

Expected: Response in < 2 seconds

## Success Criteria

All of the following must be true:

- ✅ Ollama is running and accessible
- ✅ Anonymizer model is available
- ✅ Backend starts without errors
- ✅ Health endpoint returns 200
- ✅ Anonymisation endpoint returns 200
- ✅ Response contains placeholders (e.g., `[male name]`, `[tech company]`)
- ✅ Original PII is removed (no "David", no "Google")
- ✅ Emotional context is preserved ("undermines me")
- ✅ All integration tests pass
- ✅ No raw text logging (verified by grep)
- ✅ Performance < 2 seconds per request

## Next Steps

Once all verification steps pass:

1. Mark subtask-3-1 as complete in implementation_plan.json
2. Commit changes with message: "auto-claude: subtask-3-1 - Verify Ollama connection and model availability"
3. Proceed to subtask-3-2: Test error handling for Ollama unavailable
