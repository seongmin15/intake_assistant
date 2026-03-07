import time

from intake_assistant_api.core.config import settings
from intake_assistant_api.core.exceptions import RateLimitError

_requests: dict[str, list[float]] = {}

_last_cleanup: float = 0.0
_CLEANUP_INTERVAL: float = 300.0


def _cleanup() -> None:
    global _last_cleanup
    now = time.monotonic()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    _last_cleanup = now
    window = settings.rate_limit_window_seconds
    cutoff = now - window
    expired_keys = [
        ip for ip, timestamps in _requests.items()
        if not timestamps or timestamps[-1] < cutoff
    ]
    for key in expired_keys:
        del _requests[key]


def check(ip: str) -> None:
    now = time.monotonic()
    window = settings.rate_limit_window_seconds
    max_requests = settings.rate_limit_requests
    cutoff = now - window

    timestamps = _requests.get(ip, [])
    timestamps = [t for t in timestamps if t > cutoff]

    if len(timestamps) >= max_requests:
        oldest = timestamps[0]
        retry_after = int(oldest + window - now) + 1
        _requests[ip] = timestamps
        raise RateLimitError(retry_after=retry_after)

    timestamps.append(now)
    _requests[ip] = timestamps

    _cleanup()


def reset() -> None:
    _requests.clear()
