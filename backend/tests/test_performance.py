"""
Performance tests for the Anonymiser Service.

This test suite verifies subtask-3-3 requirements:
1. All anonymisation requests complete within 2 seconds
2. Measure and log average response time for performance baseline
3. Test with typical thought text (< 280 chars)

IMPORTANT: These tests require Ollama to be running with the anonymizer model.
To set up:
1. Start Ollama: ollama serve
2. Pull the model: ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
3. Verify model: curl http://localhost:11434/api/tags | grep anonymizer
"""

import pytest
import time
import statistics
from typing import List

from services.anonymiser import AnonymiserService


# Typical thought text samples (< 280 chars each)
# These represent realistic user inputs for Echo
TYPICAL_THOUGHTS = [
    "My boss constantly undermines me in front of colleagues and I don't know how to handle it",
    "I feel like I'm not good enough no matter how hard I try",
    "Everyone at work seems to have it together except me",
    "I can't stop thinking about what people think of me",
    "My anxiety is getting worse and I don't know what to do",
    "I feel completely alone even when I'm surrounded by people",
    "I'm worried that I'm falling behind everyone else my age",
    "My relationship is falling apart and I don't know how to fix it",
    "I hate how I look and it affects everything I do",
    "I'm scared that I'll never be happy again"
]


class TestAnonymiserPerformance:
    """
    Performance tests for the Anonymiser Service.

    Acceptance Criteria (from spec.md):
    - Processing completes within 2 seconds for typical thought length (< 280 chars)

    Architecture Note (from docs/ARCHITECTURE.md):
    - Ollama should respond in < 500ms per thought
    - Backend has a 2-second timeout for the full anonymisation pipeline
    """

    @pytest.fixture
    async def anonymiser_service(self):
        """Create an anonymiser service instance for testing."""
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="eternisai/anonymizer-0.6b-q4_k_m-gguf",
            timeout_seconds=2.0
        )
        yield service
        await service.close()

    @pytest.mark.asyncio
    async def test_single_request_performance(self, anonymiser_service):
        """Test that a single anonymisation request completes within 2 seconds."""
        input_text = TYPICAL_THOUGHTS[0]

        start_time = time.time()
        result = await anonymiser_service.anonymise(input_text)
        elapsed_time = time.time() - start_time

        # Verify we got a result
        assert result, "Anonymisation should return a result"
        assert len(result) > 0, "Anonymised text should not be empty"

        # Verify performance requirement
        assert elapsed_time < 2.0, \
            f"Anonymisation took {elapsed_time:.3f}s, should be < 2.0s"

        print(f"\n✓ Single request completed in {elapsed_time:.3f}s")

    @pytest.mark.asyncio
    async def test_ten_requests_performance(self, anonymiser_service):
        """
        Test that 10 consecutive anonymisation requests all complete within 2 seconds.

        This is the primary acceptance test for subtask-3-3.
        """
        response_times: List[float] = []
        failures = []

        print("\n" + "="*80)
        print("PERFORMANCE TEST: 10 Consecutive Anonymisation Requests")
        print("="*80)

        for i, thought_text in enumerate(TYPICAL_THOUGHTS, 1):
            print(f"\nRequest {i}/10:")
            print(f"  Input length: {len(thought_text)} chars")

            start_time = time.time()

            try:
                result = await anonymiser_service.anonymise(thought_text)
                elapsed_time = time.time() - start_time
                response_times.append(elapsed_time)

                # Verify performance requirement for this request
                if elapsed_time >= 2.0:
                    failures.append({
                        'request': i,
                        'time': elapsed_time,
                        'text_preview': thought_text[:50] + "..."
                    })
                    print(f"  ✗ FAILED: {elapsed_time:.3f}s (exceeds 2.0s limit)")
                else:
                    print(f"  ✓ PASSED: {elapsed_time:.3f}s")

                # Verify we got a valid result
                assert result, f"Request {i} returned empty result"
                assert len(result) > 0, f"Request {i} returned empty anonymised text"

            except Exception as e:
                print(f"  ✗ ERROR: {str(e)}")
                failures.append({
                    'request': i,
                    'error': str(e),
                    'text_preview': thought_text[:50] + "..."
                })

        # Calculate statistics
        if response_times:
            avg_time = statistics.mean(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            median_time = statistics.median(response_times)

            if len(response_times) > 1:
                stdev_time = statistics.stdev(response_times)
            else:
                stdev_time = 0.0

            print("\n" + "="*80)
            print("PERFORMANCE BASELINE RESULTS")
            print("="*80)
            print(f"Total requests:        {len(TYPICAL_THOUGHTS)}")
            print(f"Successful requests:   {len(response_times)}")
            print(f"Failed requests:       {len(failures)}")
            print(f"\nResponse Time Statistics:")
            print(f"  Average:             {avg_time:.3f}s")
            print(f"  Median:              {median_time:.3f}s")
            print(f"  Minimum:             {min_time:.3f}s")
            print(f"  Maximum:             {max_time:.3f}s")
            print(f"  Standard deviation:  {stdev_time:.3f}s")
            print(f"\nPerformance Target:    < 2.000s per request")
            print(f"Target met:            {'YES ✓' if max_time < 2.0 else 'NO ✗'}")
            print("="*80)

            # Report failures if any
            if failures:
                print("\nFAILURES:")
                for failure in failures:
                    if 'error' in failure:
                        print(f"  Request {failure['request']}: {failure['error']}")
                    else:
                        print(f"  Request {failure['request']}: {failure['time']:.3f}s (exceeds 2.0s)")
                print("="*80)

        # Assert all requests completed within 2 seconds
        assert len(failures) == 0, \
            f"{len(failures)} request(s) failed or exceeded 2s limit. " \
            f"All requests must complete within 2s."

        # Assert we got all 10 responses
        assert len(response_times) == 10, \
            f"Expected 10 successful responses, got {len(response_times)}"

        # Assert average is reasonable (should be well under 2s)
        avg_time = statistics.mean(response_times)
        assert avg_time < 2.0, \
            f"Average response time {avg_time:.3f}s exceeds 2s"

        print(f"\n✓ All 10 requests completed successfully within 2s")
        print(f"✓ Average response time: {avg_time:.3f}s")

    @pytest.mark.asyncio
    async def test_performance_with_various_text_lengths(self, anonymiser_service):
        """
        Test performance across different text lengths.

        Verifies that performance is consistent regardless of input length
        (within the typical range).
        """
        test_cases = [
            ("Short thought", "I feel anxious"),
            ("Medium thought", "I'm worried about my performance at work and whether I'm good enough"),
            ("Long thought", "My manager keeps criticizing my work in front of the whole team during meetings and it makes me feel incompetent and embarrassed and I don't know how to handle the situation or whether I should speak up or just accept it"),
            ("Max length thought", "x" * 280)  # Maximum typical length
        ]

        print("\n" + "="*80)
        print("PERFORMANCE TEST: Various Text Lengths")
        print("="*80)

        for description, text in test_cases:
            start_time = time.time()
            result = await anonymiser_service.anonymise(text)
            elapsed_time = time.time() - start_time

            print(f"\n{description} ({len(text)} chars): {elapsed_time:.3f}s")

            assert result, f"Failed to anonymise: {description}"
            assert elapsed_time < 2.0, \
                f"{description} took {elapsed_time:.3f}s, exceeds 2s limit"

        print("\n" + "="*80)
        print("✓ All text lengths completed within 2s")
        print("="*80)

    @pytest.mark.asyncio
    async def test_performance_consistency(self, anonymiser_service):
        """
        Test that performance is consistent across multiple runs.

        Verifies that the service doesn't degrade over time or have
        significant variance between requests.
        """
        test_text = "I'm struggling with anxiety and don't know how to cope"
        response_times: List[float] = []

        # Run 5 times to check consistency
        for i in range(5):
            start_time = time.time()
            result = await anonymiser_service.anonymise(test_text)
            elapsed_time = time.time() - start_time
            response_times.append(elapsed_time)

            assert result, f"Run {i+1} failed"
            assert elapsed_time < 2.0, f"Run {i+1} took {elapsed_time:.3f}s"

        # Check consistency (standard deviation should be low)
        avg_time = statistics.mean(response_times)
        stdev_time = statistics.stdev(response_times)

        print(f"\n5 runs average: {avg_time:.3f}s ± {stdev_time:.3f}s")

        # Standard deviation should be reasonable (< 0.5s variation)
        assert stdev_time < 0.5, \
            f"High variance in response times: {stdev_time:.3f}s stdev"

        print(f"✓ Performance is consistent (stdev: {stdev_time:.3f}s)")


# Standalone script for manual performance testing
if __name__ == "__main__":
    import asyncio

    async def run_performance_test():
        """Run a standalone performance test without pytest."""
        print("\n" + "="*80)
        print("STANDALONE PERFORMANCE TEST")
        print("Echo Anonymiser Service - Performance Verification")
        print("="*80)

        # Create service
        service = AnonymiserService(
            ollama_base_url="http://localhost:11434",
            model_name="eternisai/anonymizer-0.6b-q4_k_m-gguf",
            timeout_seconds=2.0
        )

        try:
            response_times: List[float] = []

            print(f"\nTesting {len(TYPICAL_THOUGHTS)} typical thought samples...")

            for i, thought_text in enumerate(TYPICAL_THOUGHTS, 1):
                print(f"\nRequest {i}/{len(TYPICAL_THOUGHTS)}: ", end="")

                start_time = time.time()
                result = await service.anonymise(thought_text)
                elapsed_time = time.time() - start_time
                response_times.append(elapsed_time)

                if elapsed_time < 2.0:
                    print(f"✓ {elapsed_time:.3f}s")
                else:
                    print(f"✗ {elapsed_time:.3f}s (EXCEEDED 2s LIMIT)")

            # Calculate statistics
            avg_time = statistics.mean(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            median_time = statistics.median(response_times)
            stdev_time = statistics.stdev(response_times) if len(response_times) > 1 else 0.0

            print("\n" + "="*80)
            print("PERFORMANCE BASELINE RESULTS")
            print("="*80)
            print(f"Total requests:        {len(response_times)}")
            print(f"\nResponse Time Statistics:")
            print(f"  Average:             {avg_time:.3f}s")
            print(f"  Median:              {median_time:.3f}s")
            print(f"  Minimum:             {min_time:.3f}s")
            print(f"  Maximum:             {max_time:.3f}s")
            print(f"  Standard deviation:  {stdev_time:.3f}s")
            print(f"\nPerformance Target:    < 2.000s per request")
            print(f"Target met:            {'YES ✓' if max_time < 2.0 else 'NO ✗'}")
            print("="*80)

            # Success/failure summary
            passed = all(t < 2.0 for t in response_times)
            if passed:
                print("\n✓ SUCCESS: All requests completed within 2s")
                print(f"✓ Average response time: {avg_time:.3f}s")
                return 0
            else:
                print("\n✗ FAILURE: Some requests exceeded 2s limit")
                return 1

        finally:
            await service.close()

    # Run the test
    exit_code = asyncio.run(run_performance_test())
    exit(exit_code)
