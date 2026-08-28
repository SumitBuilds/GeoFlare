from fastapi import APIRouter, Request, Query
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


@router.get("/industrial-zones/nearby")
async def get_nearby_industrial_zones(
    request: Request,
    lat: float = Query(..., description="Latitude of the hotspot"),
    lng: float = Query(..., description="Longitude of the hotspot"),
    radius_m: float = Query(5000.0, description="Search radius in metres (default 5 km)"),
):
    """
    Return industrial facilities within `radius_m` metres of the given point.
    Uses PostGIS ST_DWithin on GEOGRAPHY types for accurate metre-distance.
    """
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                id,
                name,
                facility_type,
                ST_AsGeoJSON(location)::json AS geometry,
                ST_Distance(
                    location,
                    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                ) AS distance_m
            FROM industrial_facilities
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                $3
            )
            ORDER BY distance_m ASC
        """, lat, lng, radius_m)

    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
            "properties": {
                "id": row['id'],
                "name": row['name'],
                "facility_type": row['facility_type'],
                "distance_m": round(float(row['distance_m']), 1),
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }
