import asyncio
import os
import asyncpg
import sys
sys.path.insert(0, r'c:\Users\Archiet\GeoFlare\backend')

from app.api.v1.fires import build_corroboration_summary
from app.engine.rules import calculate_corroboration

async def run():
    pool = await asyncpg.create_pool(
        os.getenv('DATABASE_URL', 'postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare')
    )

    check_ids = {
        1: "Hotspot 1 - expects STRONG (VIIRS + MODIS + INSAT)",
        3: "Hotspot 3 - expects PARTIAL (VIIRS + MODIS)",
        27: "Hotspot 27 - expects STRONG (VIIRS + MODIS + Sentinel)"
    }
    
    print("\n=== Corroboration levels for demo hotspots ===\n")
    for hid, label in check_ids.items():
        obs_rows = await pool.fetch(
            "SELECT source, instrument, observed_at, confidence, data_quality_flags FROM fire_observations WHERE fire_event_id = " + str(hid)
        )
        obs_list = [dict(r) for r in obs_rows]
        summary, sources = build_corroboration_summary(obs_list, 'FIRMS_VIIRS_SNPP_NRT')
        level = calculate_corroboration(sources)
        print(f"  {label}")
        print(f"  -> Level: {level} | Sources: {sources}")
        for s in summary:
            print(f"    [{s['status']:35s}] {s['source_name']}")
        print()

    await pool.close()

asyncio.run(run())
