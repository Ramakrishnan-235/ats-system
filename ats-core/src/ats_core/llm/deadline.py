"""Cancellable wall-clock deadlines for synchronous AI worker entry points."""

import asyncio
import atexit
import threading
from contextvars import copy_context

_local = threading.local()


def invoke_with_deadline(runnable, value, *, timeout: float, config=None):
    """Cancel the async HTTP operation, including responses kept alive by pings.

    Keep one event loop per worker thread so pooled async HTTP clients remain on
    their original loop across successive Celery tasks. No request threads are
    left running after a deadline expires.
    """
    if timeout <= 0:
        raise ValueError("Model deadline must be positive")
    if not hasattr(_local, "runner"):
        _local.runner = asyncio.Runner()
        atexit.register(_local.runner.close)

    async def call():
        return await asyncio.wait_for(runnable.ainvoke(value, config=config), timeout=timeout)

    return _local.runner.run(call(), context=copy_context())
