from fastapi import APIRouter, Request, HTTPException
from typing import Optional
from ...engine.rules import HotspotInput, classify_hotspot
from ...engine.weather import get_weather_for_location
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
                h.id, h.last_observed_at as observed_at, h.first_observed_at,
                ST_Y(h.location::geometry) as latitude, ST_X(h.location::geometry) as longitude,
                ST_AsGeoJSON(h.location)::json as geometry, 
                h.confidence, h.satellite, h.temperature, h.frp, 
                h.days_observed, h.observation_count, h.alert_status, h.source, h.processed_at,
                h.approx_movement, h.persistence_confidence,
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
                ) as distance_to_nearest_facility,
                o.source_event_id, o.instrument, o.observed_at as acq_time, o.brightness_temperature, o.data_quality_flags as data_quality
            FROM hotspots h
            LEFT JOIN LATERAL (
                SELECT source_event_id, instrument, observed_at, brightness_temperature, data_quality_flags
                FROM fire_observations
                WHERE fire_event_id = h.id
                ORDER BY observed_at DESC NULLS LAST
                LIMIT 1
            ) o ON true
        """)
    
    features = []
    for row in rows:
        data = HotspotInput(
            temperature=row['temperature'],
            brightness_temperature=row['brightness_temperature'] or 0.0,
            frp=row['frp'],
            confidence=row['confidence'],
            distance_to_industrial=row['distance_to_nearest_facility'] if row['distance_to_nearest_facility'] is not None else 99999.0,
            days_observed=row['days_observed'],
            observation_count=row['observation_count'],
            industrial_zone_type=row['nearest_facility_type'],
            approx_movement=row['approx_movement'] or 0.0,
            persistence_confidence=row['persistence_confidence'] or 0.0,
            data_quality_flags=row['data_quality']
        )
        cls_output = classify_hotspot(data)
        
        if classification and cls_output.classification != classification:
            continue
        if confidence and cls_output.confidence != confidence:
            continue
            
        # Attach weather context
        weather = get_weather_for_location(row['latitude'], row['longitude'], row['observed_at'] or row['first_observed_at'])
        
        feature = {
            "type": "Feature",
            "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
            "properties": {
                "id": row['id'],
                "first_observed_at": row['first_observed_at'].isoformat() if row['first_observed_at'] else None,
                "observed_at": row['observed_at'].isoformat() if row['observed_at'] else None,
                "latitude": row['latitude'],
                "longitude": row['longitude'],
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
                "observation_count": row['observation_count'],
                "approx_movement": row['approx_movement'],
                "persistence_confidence": row['persistence_confidence'],
                "source": row['source'],
                "processed_at": row['processed_at'].isoformat() if row['processed_at'] else None,
                "source_event_id": row['source_event_id'],
                "instrument": row['instrument'],
                "acq_time": row['acq_time'].isoformat() if row['acq_time'] else None,
                "brightness_temperature": row['brightness_temperature'],
                "data_quality": row['data_quality'],
                "severity": cls_output.severity,
                "risk_score": cls_output.risk_score,
                "score_components": cls_output.score_components,
                "weather": weather.model_dump()
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
                h.id, h.last_observed_at as observed_at, h.first_observed_at,
                ST_Y(h.location::geometry) as latitude, ST_X(h.location::geometry) as longitude,
                ST_AsGeoJSON(h.location)::json as geometry, 
                h.confidence, h.satellite, h.temperature, h.frp, 
                h.days_observed, h.observation_count, h.alert_status, h.source, h.processed_at,
                h.approx_movement, h.persistence_confidence,
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
                ) as distance_to_nearest_facility,
                o.source_event_id, o.instrument, o.observed_at as acq_time, o.brightness_temperature, o.data_quality_flags as data_quality
            FROM hotspots h
            LEFT JOIN LATERAL (
                SELECT source_event_id, instrument, observed_at, brightness_temperature, data_quality_flags
                FROM fire_observations
                WHERE fire_event_id = h.id
                ORDER BY observed_at DESC NULLS LAST
                LIMIT 1
            ) o ON true
            WHERE h.id = $1
        """, fire_id)
        
    if not row:
        raise HTTPException(status_code=404, detail="Fire not found")
        
    data = HotspotInput(
        temperature=row['temperature'],
        brightness_temperature=row['brightness_temperature'] or 0.0,
        frp=row['frp'],
        confidence=row['confidence'],
        distance_to_industrial=row['distance_to_nearest_facility'] if row['distance_to_nearest_facility'] is not None else 99999.0,
        days_observed=row['days_observed'],
        observation_count=row['observation_count'],
        industrial_zone_type=row['nearest_facility_type'],
        approx_movement=row['approx_movement'] or 0.0,
        persistence_confidence=row['persistence_confidence'] or 0.0,
        data_quality_flags=row['data_quality']
    )
    cls_output = classify_hotspot(data)
    
    # Attach weather context
    weather = get_weather_for_location(row['latitude'], row['longitude'], row['observed_at'] or row['first_observed_at'])
    
    return {
        "type": "Feature",
        "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry'],
        "properties": {
            "id": row['id'],
            "first_observed_at": row['first_observed_at'].isoformat() if row['first_observed_at'] else None,
            "observed_at": row['observed_at'].isoformat() if row['observed_at'] else None,
            "latitude": row['latitude'],
            "longitude": row['longitude'],
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
            "observation_count": row['observation_count'],
            "approx_movement": row['approx_movement'],
            "persistence_confidence": row['persistence_confidence'],
            "source": row['source'],
            "processed_at": row['processed_at'].isoformat() if row['processed_at'] else None,
            "source_event_id": row['source_event_id'],
            "instrument": row['instrument'],
            "acq_time": row['acq_time'].isoformat() if row['acq_time'] else None,
            "brightness_temperature": row['brightness_temperature'],
            "data_quality": row['data_quality'],
            "severity": cls_output.severity,
            "risk_score": cls_output.risk_score,
            "score_components": cls_output.score_components,
            "weather": weather.model_dump()
        }
    }
