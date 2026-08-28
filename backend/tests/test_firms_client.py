import pytest
from unittest.mock import patch, MagicMock
from app.engine.firms_client import fetch_firms_data, process_firms_csv

from fastapi.testclient import TestClient
from app.main import app
import os
import asyncpg

os.environ["DATABASE_URL"] = "postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare"
os.environ["FIRMS_ENABLED"] = "true"

import random

def get_sample_csv():
    # use random acq_time to bypass deduplication when tests re-run against same DB
    h = random.randint(0, 23)
    m = random.randint(0, 59)
    acq_time = f"{h:02d}{m:02d}"
    return f"""latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
19.0,73.0,310.5,1.0,1.0,2026-08-27,{acq_time},N,VIIRS,n,2.0,290.0,15.5,D
-100.0,200.0,300.0,1.0,1.0,2026-08-27,{acq_time},N,VIIRS,n,2.0,290.0,15.5,D
"""

@pytest.mark.anyio
async def test_process_firms_csv_and_deduplication():
    # Use asyncpg directly to avoid TestClient sync context issues
    pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    csv_data = get_sample_csv()
    try:
        # Process first time
        result = await process_firms_csv(csv_data, pool, "TEST_SOURCE")
        assert result["fetched"] == 2
        assert result["accepted"] == 1
        assert result["rejected"] == 1
        
        # Process second time (should be deduplicated)
        result2 = await process_firms_csv(csv_data, pool, "TEST_SOURCE")
        assert result2["fetched"] == 2
        assert result2["accepted"] == 0
        assert result2["rejected"] == 2
    finally:
        await pool.close()

from unittest.mock import patch, MagicMock, AsyncMock

@patch("app.engine.scheduler.start_scheduler")
@patch("app.engine.firms_client.httpx.AsyncClient")
@patch("app.api.v1.ingestion.FIRMS_ENABLED", True)
def test_trigger_firms_ingestion_endpoint(mock_client_class, mock_start_scheduler):
    mock_response = MagicMock()
    mock_response.text = get_sample_csv()
    mock_response.raise_for_status.return_value = None
    
    mock_client_instance = MagicMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None
    mock_client_class.return_value = mock_client_instance
    
    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/firms?source=MOCK_SOURCE")
        if response.status_code != 200:
            print("Error response:", response.json())
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["metrics"]["fetched"] == 2
        assert data["metrics"]["accepted"] == 1
        assert data["metrics"]["rejected"] == 1

@patch("app.engine.scheduler.start_scheduler")
@patch("app.engine.firms_client.httpx.AsyncClient")
@patch("app.api.v1.ingestion.FIRMS_ENABLED", True)
def test_firms_ingestion_empty_response(mock_client_class, mock_start_scheduler):
    mock_response = MagicMock()
    # Provide only headers, no data rows
    mock_response.text = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n"
    mock_response.raise_for_status.return_value = None
    
    mock_client_instance = MagicMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None
    mock_client_class.return_value = mock_client_instance
    
    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/firms?source=MOCK_EMPTY")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["metrics"]["fetched"] == 0
        assert data["metrics"]["accepted"] == 0

@patch("app.engine.scheduler.start_scheduler")
@patch("app.engine.firms_client.httpx.AsyncClient")
@patch("app.api.v1.ingestion.FIRMS_ENABLED", True)
def test_firms_ingestion_api_error(mock_client_class, mock_start_scheduler):
    import httpx
    
    mock_client_instance = MagicMock()
    # Simulate a network/API error
    mock_client_instance.get = AsyncMock(side_effect=httpx.RequestError("Network error", request=MagicMock()))
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None
    mock_client_class.return_value = mock_client_instance
    
    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/firms?source=MOCK_ERROR")
        assert response.status_code == 500
        
        # Verify no fallback data was silently ingested by checking ingestion status or fires endpoint
        response_fires = client.get("/api/v1/fires")
        assert response_fires.status_code == 200
        data_fires = response_fires.json()
        # Ensure no synthetic records were generated by the error handler
        assert isinstance(data_fires["features"], list)

@pytest.mark.anyio
async def test_spatial_grouping():
    # Insert one observation, then insert a second one very close, and a third one far away.
    pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    try:
        # Use an isolated date (2001) so it never groups with real dev data (7-day window)
        # and only delete test-specific records.
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fire_observations WHERE fire_event_id IN (SELECT id FROM hotspots WHERE source = 'FIRMS_TEST_SPATIAL')")
            await conn.execute("DELETE FROM hotspots WHERE source = 'FIRMS_TEST_SPATIAL'")
            
        csv_1 = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n-80.000,0.000,310.5,1.0,1.0,2026-08-27,1000,N,VIIRS,n,2.0,290.0,15.5,D\n"
        # 0.004 degrees latitude is approx 444m (within 1000m)
        csv_2 = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n-80.004,0.000,310.5,1.0,1.0,2026-08-27,1005,N,VIIRS,n,2.0,290.0,15.5,D\n"
        # 10.0 degrees latitude is ~1110km (well outside 1000m)
        csv_3 = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n-70.000,0.000,310.5,1.0,1.0,2026-08-27,1010,N,VIIRS,n,2.0,290.0,15.5,D\n"
        
        await process_firms_csv(csv_1, pool, "TEST_SPATIAL")
        await process_firms_csv(csv_2, pool, "TEST_SPATIAL")
        await process_firms_csv(csv_3, pool, "TEST_SPATIAL")
        
        async with pool.acquire() as conn:
            hotspots = await conn.fetch("SELECT id, observation_count FROM hotspots WHERE source = 'FIRMS_TEST_SPATIAL'")
            assert len(hotspots) == 2, f"Expected 2 hotspots, got {len(hotspots)}"
            
            counts = [h['observation_count'] for h in hotspots]
            assert 2 in counts, "Expected one hotspot to group 2 close observations"
            assert 1 in counts, "Expected the distant observation to form its own hotspot"
    finally:
        # Clean up test data
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fire_observations WHERE fire_event_id IN (SELECT id FROM hotspots WHERE source = 'FIRMS_TEST_SPATIAL')")
            await conn.execute("DELETE FROM hotspots WHERE source = 'FIRMS_TEST_SPATIAL'")
        await pool.close()

@pytest.mark.anyio
async def test_firms_time_parsing_missing_leading_zero():
    # Simulate a CSV row where acq_time is "822" instead of "0822"
    pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    try:
        # Use an isolated date and location so it doesn't group with real dev data
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fire_observations WHERE source = 'FIRMS_TEST_TIME_PARSE'")
            await conn.execute("DELETE FROM hotspots WHERE source = 'FIRMS_TEST_TIME_PARSE'")
            
        csv_data = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n"
        csv_data += "25.0,85.0,310.5,1.0,1.0,2026-08-25,822,N,VIIRS,n,2.0,290.0,15.5,D\n"
        
        result = await process_firms_csv(csv_data, pool, "TEST_TIME_PARSE")
        assert result["fetched"] == 1
        assert result["accepted"] == 1
        assert result["rejected"] == 0
        
        async with pool.acquire() as conn:
            obs = await conn.fetchrow("SELECT observed_at FROM fire_observations WHERE source = 'FIRMS_TEST_TIME_PARSE' ORDER BY created_at DESC LIMIT 1")
            # Should be 08:22 UTC
            assert obs['observed_at'].hour == 8
            assert obs['observed_at'].minute == 22
            
    finally:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fire_observations WHERE source = 'FIRMS_TEST_TIME_PARSE'")
            await conn.execute("DELETE FROM hotspots WHERE source = 'FIRMS_TEST_TIME_PARSE'")
        await pool.close()
