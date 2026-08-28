import csv
import io
import httpx
import logging
from datetime import datetime, timedelta
import asyncio
from app.core.config import FIRMS_MAP_KEY, FIRMS_SOURCE, FIRMS_BBOX, FIRMS_DAY_RANGE, FIRMS_TIMEOUT_SECONDS, GROUPING_SPATIAL_DISTANCE_M, GROUPING_TIME_WINDOW_DAYS
import asyncpg

async def fetch_firms_data(pool: asyncpg.Pool, source: str = None, bbox: str = None, day_range: str = None):
    source = source or FIRMS_SOURCE
    bbox = bbox or FIRMS_BBOX
    day_range = day_range or FIRMS_DAY_RANGE
    
    if FIRMS_MAP_KEY:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/{source}/{bbox}/{day_range}"
    else:
        url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv"
    
    retries = 3
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=FIRMS_TIMEOUT_SECONDS) as client:
                response = await client.get(url)
                response.raise_for_status()
                print("DEBUG: Fetched text length:", len(response.text))
                return await process_firms_csv(response.text, pool, source, bbox)
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (400, 401, 403, 404) and attempt == 0:
                print("DEBUG: API key failed, falling back to public 7d CSV")
                url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv"
                continue
            if attempt == retries - 1:
                await update_source_health(pool, source, "failed", 0, 0, 0, str(e))
                raise e
            await asyncio.sleep(2 ** attempt)
        except httpx.RequestError as e:
            if attempt == retries - 1:
                await update_source_health(pool, source, "failed", 0, 0, 0, str(e))
                raise e
            await asyncio.sleep(2 ** attempt)

async def process_firms_csv(csv_text: str, pool: asyncpg.Pool, source_name: str, bbox: str = None):
    reader = csv.DictReader(io.StringIO(csv_text))
    
    records_fetched = 0
    records_accepted = 0
    records_rejected = 0
    
    min_lon, min_lat, max_lon, max_lat = -180.0, -90.0, 180.0, 90.0
    if bbox:
        try:
            parts = [float(x.strip()) for x in bbox.split(',')]
            if len(parts) == 4:
                min_lon, min_lat, max_lon, max_lat = parts
        except ValueError:
            pass
            
    async with pool.acquire() as conn:
        async with conn.transaction():
            for row in reader:
                records_fetched += 1
                try:
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    
                    if not (min_lat <= lat <= max_lat and min_lon <= lon <= max_lon):
                        records_rejected += 1
                        continue
                        
                    acq_date = row['acq_date']
                    acq_time = row['acq_time'].zfill(4)
                    
                    # acq_date is YYYY-MM-DD, acq_time is HHMM
                    dt_str = f"{acq_date} {acq_time[:2]}:{acq_time[2:]}:00+00:00"
                    observed_at = datetime.fromisoformat(dt_str)
                    
                    source_event_id = f"{lat}_{lon}_{acq_date}_{acq_time}"
                    
                    brightness = float(row.get('brightness', 0) or row.get('bright_ti4', 0))
                    frp = float(row.get('frp', 0))
                    confidence = row.get('confidence', 'nominal')
                    instrument = row.get('instrument', 'unknown')
                    satellite = row.get('satellite', 'unknown')
                    
                    import json
                    raw_metadata = json.dumps({k: v for k, v in row.items()})
                    
                    # Spatial matching: find existing hotspot within GROUPING_SPATIAL_DISTANCE_M and GROUPING_TIME_WINDOW_DAYS
                    existing_hotspot = await conn.fetchrow("""
                        SELECT id, first_observed_at, last_observed_at, observation_count, location 
                        FROM hotspots 
                        WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
                        AND (last_observed_at >= $4::timestamptz - interval '1 day' * $5)
                        ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
                        LIMIT 1
                    """, lon, lat, GROUPING_SPATIAL_DISTANCE_M, observed_at, GROUPING_TIME_WINDOW_DAYS)
                    
                    if existing_hotspot:
                        hotspot_id = existing_hotspot['id']
                        # calculate movement distance
                        movement = await conn.fetchval("SELECT ST_Distance($1::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)", existing_hotspot['location'], lon, lat)
                        
                        await conn.execute("""
                            UPDATE hotspots SET 
                                last_observed_at = GREATEST(last_observed_at, $2),
                                first_observed_at = LEAST(first_observed_at, $2),
                                observation_count = observation_count + 1,
                                approx_movement = GREATEST(approx_movement, $3),
                                days_observed = EXTRACT(DAY FROM (GREATEST(last_observed_at, $2) - LEAST(first_observed_at, $2))) + 1,
                                persistence_confidence = LEAST((observation_count + 1.0) / (EXTRACT(DAY FROM (GREATEST(last_observed_at, $2) - LEAST(first_observed_at, $2))) + 1.0), 5.0)
                            WHERE id = $1
                        """, hotspot_id, observed_at, movement)
                    else:
                        hotspot_id = await conn.fetchval("""
                            INSERT INTO hotspots (location, confidence, satellite, temperature, frp, source, first_observed_at, last_observed_at, approx_movement, persistence_confidence)
                            VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, $6, $7, $8, $8, 0.0, 1.0)
                            RETURNING id
                        """, lon, lat, confidence, satellite, brightness, frp, f"FIRMS_{source_name}", observed_at)
                    
                    # Insert into fire_observations
                    inserted = await conn.execute("""
                        INSERT INTO fire_observations 
                        (fire_event_id, source, source_event_id, satellite, instrument, observed_at, 
                        brightness_temperature, temperature, frp, confidence, location, raw_metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, ST_SetSRID(ST_MakePoint($10, $11), 4326), $12)
                        ON CONFLICT (source, source_event_id) DO NOTHING
                    """, hotspot_id, f"FIRMS_{source_name}", source_event_id, satellite, instrument, observed_at, 
                         brightness, frp, confidence, lon, lat, raw_metadata)
                    
                    if inserted == "INSERT 0 1":
                        records_accepted += 1
                    else:
                        records_rejected += 1 # deduplicated
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    records_rejected += 1
                    
            await update_source_health(conn, source_name, "active", records_fetched, records_accepted, records_rejected)
            
    return {"fetched": records_fetched, "accepted": records_accepted, "rejected": records_rejected}

async def update_source_health(conn, source_name: str, status: str, fetched: int, accepted: int, rejected: int, error_msg: str = None):
    query = """
        INSERT INTO source_health 
        (source_name, status, last_attempt, records_fetched, records_accepted, records_rejected, error_message, last_successful_ingest, last_failed_ingest, latest_observation_time)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, 
            CASE WHEN $2 = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END,
            CASE WHEN $2 = 'failed' THEN CURRENT_TIMESTAMP ELSE NULL END,
            CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING;
    """
    # Wait, source_health doesn't have a unique constraint on source_name!
    # Let's check schema.sql: id is serial primary key, no unique constraint on source_name.
    # So we should probably do an update if exists, or just insert new rows?
    # Usually health tables store latest or a history. We can just update the existing row if it exists, else insert.
    
    # Check if exists
    exists = await conn.fetchval("SELECT id FROM source_health WHERE source_name = $1", source_name)
    now = datetime.now()
    if exists:
        await conn.execute("""
            UPDATE source_health SET 
                status = $1,
                last_attempt = CURRENT_TIMESTAMP,
                records_fetched = $2,
                records_accepted = $3,
                records_rejected = $4,
                error_message = $5,
                last_successful_ingest = COALESCE($7, last_successful_ingest),
                last_failed_ingest = COALESCE($8, last_failed_ingest),
                updated_at = CURRENT_TIMESTAMP
            WHERE source_name = $6
        """, status, fetched, accepted, rejected, error_msg, source_name,
        now if status == 'active' else None,
        now if status == 'failed' else None)
    else:
        await conn.execute("""
            INSERT INTO source_health 
            (source_name, status, last_attempt, records_fetched, records_accepted, records_rejected, error_message, last_successful_ingest, last_failed_ingest)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8)
        """, source_name, status, fetched, accepted, rejected, error_msg,
        now if status == 'active' else None,
        now if status == 'failed' else None)
