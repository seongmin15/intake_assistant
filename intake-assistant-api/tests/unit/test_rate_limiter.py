import time
from unittest.mock import patch

import pytest

from intake_assistant_api.core.exceptions import RateLimitError
from intake_assistant_api.core.rate_limiter import check, reset


@pytest.fixture(autouse=True)
def _clean_state():
    reset()
    yield
    reset()


def test_allows_requests_within_limit():
    for _ in range(20):
        check("127.0.0.1")


def test_blocks_when_limit_exceeded():
    for _ in range(20):
        check("127.0.0.1")

    with pytest.raises(RateLimitError) as exc_info:
        check("127.0.0.1")

    assert exc_info.value.status_code == 429
    assert exc_info.value.retry_after > 0


def test_different_ips_have_separate_limits():
    for _ in range(20):
        check("10.0.0.1")

    # Different IP should still be allowed
    check("10.0.0.2")


def test_allows_requests_after_window_expires():
    base_time = time.monotonic()

    with patch("intake_assistant_api.core.rate_limiter.time.monotonic", return_value=base_time):
        for _ in range(20):
            check("127.0.0.1")

    # Advance past the window (default 60s)
    future_time = base_time + 61
    with patch("intake_assistant_api.core.rate_limiter.time.monotonic", return_value=future_time):
        check("127.0.0.1")  # Should not raise


def test_retry_after_header_value():
    base_time = time.monotonic()

    with patch("intake_assistant_api.core.rate_limiter.time.monotonic", return_value=base_time):
        for _ in range(20):
            check("127.0.0.1")

    later_time = base_time + 10
    with patch("intake_assistant_api.core.rate_limiter.time.monotonic", return_value=later_time):
        with pytest.raises(RateLimitError) as exc_info:
            check("127.0.0.1")

        # retry_after should be roughly (60 - 10) + 1 = 51
        assert 40 <= exc_info.value.retry_after <= 55
