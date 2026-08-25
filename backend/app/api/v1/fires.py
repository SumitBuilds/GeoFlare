from fastapi import APIRouter, Request, HTTPException
from typing import Optional
from ...engine.rules import HotspotInput, classify_hotspot
import json

router = APIRouter()

@router.get("/fires")
async def get_fires(
    request: Request,
    classification: Optional[str] = None,
    confidence: Optional[str] = None
):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                h.id, h.observed_at, ST_AsGeoJSON(h.location)::json as geometry, 
                h.confidence, h.satellite, h.temperature, h.frp, 
                h.days_observed, h.observation_count, h.alert_status,
                (
                    SELECT f.facility_type 
                    FROM industrial_facilities f 
                    ORDER BY ST_Distance(h.location, f.location) ASC 
                    LIMIT 1
                ) as nearest_facility_type,
                (
                    SELECT ST_Distance(h.location, f.location) 
                    FROM industrial_facilities f 
                    ORDER BY ST_Distance(h.location, f.location) ASC 
                    LIMIT 1
                ) as distance_to_nearest_facility
            FROM hotspots h
        """)
    
    features = []
    for row in rows:
        data = HotspotInput(
            temperature=row['temperature'],
            frp=row['frp'],
            confidence=row['confidence'],
            distance_to_industrial=row['distance_to_nearest_facility'] if row['distance_to_nearest_facility'] is not None else 99999.0,
            days_observed=row['days_observed'],
            observation_count=row['observation_count'],
            industrial_zone_type=row['nearest_facility_type']
        )
        cls_output = classify_hotspot(data)
        
        if classification and cls_output.classification != classification:
            continue
        if confidence and cls_output.confidence != confidence:
            continue
            
        feature = {
            "type": "Feature",
            "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
            "properties": {
                "id": row['id'],
                "observed_at": row['observed_at'].isoformat() if row['observed_at'] else None,
                "confidence": row['confidence'],
                "satellite": row['satellite'],
                "temperature": row['temperature'],
                "frp": row['frp'],
                "alert_status": row['alert_status'],
                "classification": cls_output.classification,
                "subclass": cls_output.subclass,
                "classification_confidence": cls_output.confidence,
                "evidence": cls_output.evidence,
                "explanation": cls_output.explanation,
                "distance_to_industrial": row['distance_to_nearest_facility'],
                "facility_type": row['nearest_facility_type'],
                "days_observed": row['days_observed'],
                "observation_count": row['observation_count']
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }

@router.get("/fires/{fire_id}")
async def get_fire(fire_id: int, request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                h.id, h.observed_at, ST_AsGeoJSON(h.location)::json as geometry, 
                h.confidence, h.satellite, h.temperature, h.frp, 
                h.days_observed, h.observation_count, h.alert_status,
                (
                    SELECT f.facility_type 
                    FROM industrial_facilities f 
                    ORDER BY ST_Distance(h.location, f.location) ASC 
                    LIMIT 1
                ) as nearest_facility_type,
                (
                    SELECT ST_Distance(h.location, f.location) 
                    FROM industrial_facilities f 
                    ORDER BY ST_Distance(h.location, f.location) ASC 
                    LIMIT 1
                ) as distance_to_nearest_facility
            FROM hotspots h
            WHERE h.id = $1
        """, fire_id)
        
    if not row:
        raise HTTPException(status_code=404, detail="Fire not found")
        
    data = HotspotInput(
        temperature=row['temperature'],
        frp=row['frp'],
        confidence=row['confidence'],
        distance_to_industrial=row['distance_to_nearest_facility'] if row['distance_to_nearest_facility'] is not None else 99999.0,
        days_observed=row['days_observed'],
        observation_count=row['observation_count'],
        industrial_zone_type=row['nearest_facility_type']
    )
    cls_output = classify_hotspot(data)
    
    return {
        "type": "Feature",
        "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
        "properties": {
            "id": row['id'],
            "observed_at": row['observed_at'].isoformat() if row['observed_at'] else None,
            "confidence": row['confidence'],
            "satellite": row['satellite'],
            "temperature": row['temperature'],
            "frp": row['frp'],
            "alert_status": row['alert_status'],
            "classification": cls_output.classification,
            "subclass": cls_output.subclass,
            "classification_confidence": cls_output.confidence,
            "evidence": cls_output.evidence,
            "explanation": cls_output.explanation,
            "distance_to_industrial": row['distance_to_nearest_facility'],
            "facility_type": row['nearest_facility_type'],
            "days_observed": row['days_observed'],
            "observation_count": row['observation_count']
        }
    }
