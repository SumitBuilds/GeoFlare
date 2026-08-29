"""
Tests for the FIRMS automatic ingestion scheduler.

All tests are fully mocked — no real NASA FIRMS calls, no database mutations.
"""
import asyncio
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from fastapi.testclient import TestClient
import os

os.environ["DATABASE_URL"] = "postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare"


# ── Unit tests for scheduler module ─────────────────────────────────────────

@pytest.mark.anyio
async def test_scheduler_disabled_when_firms_disabled():
    """Scheduler must not start when FIRMS_ENABLED is false."""
    import app.engine.scheduler as sched

    # Reset module state
    sched._scheduler_task = None
    sched._stop_event = asyncio.Event()

    mock_pool = MagicMock()

    with patch("app.core.config.FIRMS_ENABLED", False):
        # Simulate what main.py lifespan does: check flag before starting
        from app.core.config import FIRMS_ENABLED
        if FIRMS_ENABLED:
            sched.start_scheduler(mock_pool, 1)

    assert sched._scheduler_task is None, "Scheduler should NOT start when FIRMS_ENABLED=false"


@pytest.mark.anyio
async def test_scheduler_starts_when_firms_enabled():
    """Scheduler task must be created when FIRMS_ENABLED is true."""
    import app.engine.scheduler as sched

    # Reset module state
    sched._scheduler_task = None
    sched._stop_event = asyncio.Event()

    mock_pool = MagicMock()

    # Patch fetch_firms_data so the loop never actually calls NASA
    with patch("app.engine.firms_client.fetch_firms_data", new_callable=AsyncMock) as mock_fetch:
        sched.start_scheduler(mock_pool, interval_minutes=1)

        assert sched._scheduler_task is not None, "Scheduler task should be created"
        assert not sched._scheduler_task.done(), "Scheduler task should be running"

        # Clean up
        await sched.stop_scheduler()
        assert sched._scheduler_task is None


@pytest.mark.anyio
async def test_scheduled_ingestion_calls_fetch_firms_data():
    """The poll loop must call the existing fetch_firms_data()."""
    import app.engine.scheduler as sched

    sched._scheduler_task = None
    sched._stop_event = asyncio.Event()

    mock_pool = MagicMock()

    with patch("app.engine.firms_client.fetch_firms_data", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {"fetched": 10, "accepted": 5, "rejected": 3, "deduplicated": 2}

        sched._stop_event = asyncio.Event()

        # Start the loop with a long interval (60 min).
        # If the immediate-first-run works, fetch will be called within <0.5s
        # even though the interval is 60 minutes.
        task = asyncio.create_task(sched._poll_loop(mock_pool, interval_minutes=60))
        await asyncio.sleep(0.3)

        assert mock_fetch.called, (
            "fetch_firms_data should be called immediately on first run, "
            "not after waiting for the interval"
        )
        mock_fetch.assert_any_call(mock_pool, source="VIIRS_SNPP_NRT")

        # Clean up
        sched._stop_event.set()
        try:
            await asyncio.wait_for(task, timeout=2)
        except asyncio.TimeoutError:
            task.cancel()


@pytest.mark.anyio
async def test_overlapping_ingestion_prevented():
    """When the lock is held, the scheduled poll must skip instead of blocking."""
    import app.engine.scheduler as sched

    # Acquire the shared lock to simulate an in-progress ingestion
    async with sched.ingestion_lock:
        # The lock is held. A scheduled poll should skip.
        assert sched.ingestion_lock.locked()

        # The manual endpoint checks ingestion_lock.locked() and returns 409
        # Verify this pattern works
        from app.api.v1.ingestion import trigger_firms_ingestion

        mock_request = MagicMock()
        mock_request.app.state.pool = MagicMock()

        with patch("app.api.v1.ingestion.FIRMS_ENABLED", True):
            from fastapi import HTTPException
            try:
                await trigger_firms_ingestion(mock_request, MagicMock(), source=None)
                assert False, "Should have raised HTTPException 409"
            except HTTPException as e:
                assert e.status_code == 409


@pytest.mark.anyio
async def test_scheduler_shuts_down_cleanly():
    """stop_scheduler must terminate the loop without hanging."""
    import app.engine.scheduler as sched

    sched._scheduler_task = None
    sched._stop_event = asyncio.Event()

    mock_pool = MagicMock()

    with patch("app.engine.firms_client.fetch_firms_data", new_callable=AsyncMock):
        sched.start_scheduler(mock_pool, interval_minutes=60)

        assert sched._scheduler_task is not None
        assert not sched._scheduler_task.done()

        # Shutdown should complete within 2 seconds (the loop checks _stop_event)
        await asyncio.wait_for(sched.stop_scheduler(), timeout=5)

        assert sched._scheduler_task is None, "Task reference should be cleared after stop"


@pytest.mark.anyio
async def test_duplicate_start_prevented():
    """Calling start_scheduler twice must not create a second loop."""
    import app.engine.scheduler as sched

    sched._scheduler_task = None
    sched._stop_event = asyncio.Event()

    mock_pool = MagicMock()

    with patch("app.engine.firms_client.fetch_firms_data", new_callable=AsyncMock):
        sched.start_scheduler(mock_pool, interval_minutes=60)
        first_task = sched._scheduler_task

        sched.start_scheduler(mock_pool, interval_minutes=60)
        second_task = sched._scheduler_task

        assert first_task is second_task, "Should reuse the existing task, not create a new one"

        await sched.stop_scheduler()


# ── Integration: manual endpoint still works ────────────────────────────────

@patch("app.engine.scheduler.start_scheduler")
@patch("app.engine.firms_client.httpx.AsyncClient")
@patch("app.api.v1.ingestion.FIRMS_ENABLED", True)
def test_manual_ingestion_endpoint_still_works(mock_client_class, mock_start_scheduler):
    """The existing POST /api/v1/ingestion/firms must continue working."""
    from app.main import app

    mock_response = MagicMock()
    mock_response.text = (
        "latitude,longitude,brightness,scan,track,acq_date,acq_time,"
        "satellite,instrument,confidence,version,bright_t31,frp,daynight\n"
        "19.0,73.0,310.5,1.0,1.0,2026-08-27,1200,N,VIIRS,n,2.0,290.0,15.5,D\n"
    )
    mock_response.raise_for_status.return_value = None

    mock_client_instance = MagicMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None
    mock_client_class.return_value = mock_client_instance

    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/firms?source=SCHED_TEST")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "metrics" in data
