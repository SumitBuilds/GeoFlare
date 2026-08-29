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


@router.get("/fires/{fire_id}/nearest-industries")
async def get_nearest_industries_to_fire(
    request: Request,
    fire_id: int,
    limit: int = Query(10, description="Max number of results (default 10)"),
):
    """
    Return the top N nearest industrial facilities to a specific hotspot.
    Uses PostGIS ST_Distance on GEOGRAPHY types for accurate metre-distance.
    No radius limit — returns the absolute closest facilities regardless of distance.
    """
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        # First get the hotspot location
        hotspot = await conn.fetchrow("""
            SELECT id, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
            FROM hotspots WHERE id = $1
        """, fire_id)
        
        if not hotspot:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Hotspot not found")
        
        rows = await conn.fetch("""
            SELECT
                f.id,
                f.name,
                f.facility_type,
                ST_AsGeoJSON(f.location)::json AS geometry,
                ST_Y(ST_Centroid(f.location::geometry)) AS facility_lat,
                ST_X(ST_Centroid(f.location::geometry)) AS facility_lng,
                ST_Distance(
                    f.location,
                    h.location
                ) AS distance_m
            FROM industrial_facilities f, hotspots h
            WHERE h.id = $1
            ORDER BY distance_m ASC
            LIMIT $2
        """, fire_id, limit)

    facilities = []
    for row in rows:
        facilities.append({
            "id": row['id'],
            "name": row['name'],
            "facility_type": row['facility_type'],
            "distance_m": round(float(row['distance_m']), 1),
            "distance_km": round(float(row['distance_m']) / 1000, 2),
            "facility_lat": float(row['facility_lat']),
            "facility_lng": float(row['facility_lng']),
            "within_1km_halo": float(row['distance_m']) <= 1000,
        })

    return {
        "hotspot_id": fire_id,
        "hotspot_lat": float(hotspot['lat']),
        "hotspot_lng": float(hotspot['lng']),
        "facilities": facilities,
        "total": len(facilities),
    }
