"""Exponential backoff retry utility.

Provides a generic async retry wrapper with configurable policy,
exponential backoff, and jitter.
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

# Exceptions that are considered retryable
_RETRYABLE_EXCEPTIONS: tuple[type[Exception], ...] = (
    httpx.TimeoutException,
    httpx.NetworkError,
    ConnectionError,
    TimeoutError,
)


@dataclass
class RetryPolicy:
    """Configuration for retry behavior."""

    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_exceptions: tuple[type[Exception], ...] = field(
        default_factory=lambda: _RETRYABLE_EXCEPTIONS
    )


_DEFAULT_POLICY = RetryPolicy()


async def with_retry(
    coro_factory,
    policy: RetryPolicy | None = None,
):
    """Execute an async operation with exponential backoff retry.

    Args:
        coro_factory: A callable that returns a new coroutine on each call.
            Example: ``lambda: my_async_function(arg1, arg2)``
        policy: Retry configuration. Uses default if not provided.

    Returns:
        The result of the coroutine on success.

    Raises:
        The last exception if all retries are exhausted.
    """
    policy = policy or _DEFAULT_POLICY
    last_exc: Exception | None = None

    for attempt in range(1, policy.max_retries + 2):  # +1 for initial attempt, +1 for range
        try:
            return await coro_factory()
        except policy.retryable_exceptions as exc:
            last_exc = exc
            if attempt > policy.max_retries:
                logger.error(
                    "All %d retries exhausted. Last error: %s",
                    policy.max_retries,
                    exc,
                )
                raise

            delay = min(
                policy.base_delay * (policy.exponential_base ** (attempt - 1)),
                policy.max_delay,
            )

            if policy.jitter:
                delay = delay * (0.5 + random.random())

            logger.warning(
                "Attempt %d/%d failed (%s: %s). Retrying in %.1fs...",
                attempt,
                policy.max_retries + 1,
                type(exc).__name__,
                str(exc)[:200],
                delay,
            )
            await asyncio.sleep(delay)

    # Should not reach here, but just in case
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("Retry loop exited unexpectedly")
