"""
Lightweight background scheduler for automatic FIRMS ingestion.

Uses asyncio.create_task — no external dependencies (no Celery, no Redis).
Shares an asyncio.Lock with the manual endpoint to prevent overlapping runs.
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("geoflare.scheduler")

# Shared lock: prevents manual and scheduled ingestion from overlapping.
ingestion_lock = asyncio.Lock()

# Internal state
_scheduler_task: asyncio.Task | None = None
_stop_event: asyncio.Event = asyncio.Event()


async def _poll_loop(pool, interval_minutes: int) -> None:
    """Run fetch_firms_data() immediately on start, then every interval_minutes."""
    # Lazy import to avoid circular dependencies at module load time
    from app.engine.firms_client import fetch_firms_data

    logger.info(
        "FIRMS scheduler started — polling every %d minutes", interval_minutes
    )

    first_run = True

    while not _stop_event.is_set():
        # On the first iteration, run immediately; afterwards, wait for the interval
        if not first_run:
            try:
                await asyncio.wait_for(
                    _stop_event.wait(), timeout=interval_minutes * 60
                )
                # If wait_for returns without timeout, stop_event was set → exit
                break
            except asyncio.TimeoutError:
                pass  # Normal: interval elapsed, time to poll

        first_run = False

        if ingestion_lock.locked():
            logger.info(
                "Scheduled FIRMS poll skipped — another ingestion is in progress"
            )
            continue

        async with ingestion_lock:
            try:
                logger.info(
                    "Scheduled FIRMS ingestion starting at %s",
                    datetime.now(timezone.utc).isoformat(),
                )
                result = await fetch_firms_data(pool)
                logger.info(
                    "Scheduled FIRMS ingestion complete: fetched=%s accepted=%s rejected=%s",
                    result.get("fetched"),
                    result.get("accepted"),
                    result.get("rejected"),
                )
            except Exception:
                logger.exception("Scheduled FIRMS ingestion failed")

    logger.info("FIRMS scheduler stopped")


def start_scheduler(pool, interval_minutes: int) -> None:
    """Create the background polling task. Safe to call multiple times — only one loop runs."""
    global _scheduler_task, _stop_event

    if _scheduler_task is not None and not _scheduler_task.done():
        logger.warning("Scheduler already running — ignoring duplicate start")
        return

    # Reset the stop event for a fresh run
    _stop_event = asyncio.Event()
    _scheduler_task = asyncio.create_task(_poll_loop(pool, interval_minutes))


async def stop_scheduler() -> None:
    """Signal the polling loop to exit and wait for it to finish."""
    global _scheduler_task

    if _scheduler_task is None or _scheduler_task.done():
        return

    _stop_event.set()
    try:
        await asyncio.wait_for(_scheduler_task, timeout=10)
    except asyncio.TimeoutError:
        logger.warning("Scheduler did not stop within 10s — cancelling")
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None
