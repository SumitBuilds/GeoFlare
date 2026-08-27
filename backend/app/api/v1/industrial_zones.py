from fastapi import APIRouter, Request
import json

router = APIRouter()

@router.get("/industrial-zones")
async def get_industrial_zones(request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, facility_type, ST_AsGeoJSON(location)::json as geometry
            FROM industrial_facilities
        """)
        
    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
            "properties": {
                "id": row['id'],
                "name": row['name'],
                "facility_type": row['facility_type']
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }
