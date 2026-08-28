from fastapi import APIRouter, Request, HTTPException
from typing import Optional
from ...engine.rules import HotspotInput, classify_hotspot
from ...engine.weather import get_weather_for_location
import json
from datetime import datetime, timezone

def build_corroboration_summary(all_obs_raw, hotspot_source):
    all_obs = all_obs_raw
    if isinstance(all_obs_raw, str):
        try:
            all_obs = json.loads(all_obs_raw)
        except Exception:
            all_obs = []
    if not all_obs:
        all_obs = []
        
    is_demo = hotspot_source and "Synthetic" in hotspot_source
    
    sources = [
        {"id": "VIIRS", "name": "NASA FIRMS VIIRS"},
        {"id": "MODIS", "name": "NASA FIRMS MODIS"},
        {"id": "INSAT", "name": "INSAT-3D"},
        {"id": "SENTINEL", "name": "Sentinel-3"},
        {"id": "SYNTHETIC", "name": "Synthetic Demo"}
    ]
    
    summary = []
    obs_sources_strings = []
    
    for s in sources:
        found = None
        if s["id"] == "SYNTHETIC":
            if is_demo:
                found = {"observed_at": datetime.now().isoformat(), "confidence": "high", "data_quality_flags": "Demo scenario"}
                obs_sources_strings.append("Synthetic Demo")
        else:
            for obs in all_obs:
                if not obs: continue
                inst = str(obs.get('instrument') or "").upper()
                src = str(obs.get('source') or "").upper()
                if s["id"] == inst or \
                   (s["id"] == "INSAT" and ("INSAT" in inst or "INSAT" in src)) or \
                   (s["id"] == "SENTINEL" and ("SENTINEL" in inst or "SENTINEL" in src)) or \
                   (s["id"] == "MODIS" and ("MODIS" in inst or "MODIS" in src)) or \
                   (s["id"] == "VIIRS" and ("VIIRS" in inst or "VIIRS" in src)):
                    found = obs
                    obs_sources_strings.append(f"{src}:{inst}")
                    break
                    
        if found:
            status = "Synthetic scenario" if s["id"] == "SYNTHETIC" else "Detected"
            summary.append({
                "source_name": s["name"],
                "status": status,
                "timestamp": found.get("observed_at"),
                "confidence": found.get("confidence"),
                "data_quality": found.get("data_quality_flags")
            })
        else:
            if is_demo and s["id"] != "SYNTHETIC":
                status = "Unavailable"
            elif s["id"] in ["INSAT", "SENTINEL"]:
                status = "Not connected"
            elif s["id"] == "SYNTHETIC":
                status = "No matching observation" 
            else:
                status = "No matching observation"
                
            summary.append({
                "source_name": s["name"],
                "status": status,
                "timestamp": None,
                "confidence": None,
                "data_quality": None
            })
            
    return summary, list(set(obs_sources_strings))

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
                o.source_event_id, o.instrument, o.observed_at as acq_time, o.brightness_temperature, o.data_quality_flags as data_quality,
                obs.all_observations
            FROM hotspots h
            LEFT JOIN LATERAL (
                SELECT source_event_id, instrument, observed_at, brightness_temperature, data_quality_flags
                FROM fire_observations
                WHERE fire_event_id = h.id
                ORDER BY observed_at DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'source', f_obs.source,
                        'instrument', f_obs.instrument,
                        'observed_at', f_obs.observed_at,
                        'confidence', f_obs.confidence,
                        'data_quality_flags', f_obs.data_quality_flags
                    )
                ) as all_observations
                FROM fire_observations f_obs
                WHERE f_obs.fire_event_id = h.id
            ) obs ON true
        """)
    
    features = []
    now_utc = datetime.now(timezone.utc)
    for row in rows:
        all_obs_raw = row['all_observations']
        if isinstance(all_obs_raw, str):
            try:
                all_obs_list = json.loads(all_obs_raw)
            except Exception:
                all_obs_list = []
        else:
            all_obs_list = all_obs_raw or []
            
        summary, obs_sources = build_corroboration_summary(all_obs_raw, row['source'])
        
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
            data_quality_flags=row['data_quality'],
            observation_sources=obs_sources
        )
        cls_output = classify_hotspot(data)
        
        if classification and cls_output.classification != classification:
            continue
        if confidence and cls_output.confidence != confidence:
            continue
            
        # Attach weather context
        weather = get_weather_for_location(row['latitude'], row['longitude'], row['observed_at'] or row['first_observed_at'])
        
        data_freshness_mins = None
        if row['observed_at']:
            diff = now_utc - row['observed_at']
            data_freshness_mins = round(diff.total_seconds() / 60)
            
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
                "weather": weather.model_dump(),
                "corroboration": cls_output.corroboration,
                "corroboration_summary": summary,
                "observations_timeline": all_obs_list,
                "data_freshness_mins": data_freshness_mins
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
                o.source_event_id, o.instrument, o.observed_at as acq_time, o.brightness_temperature, o.data_quality_flags as data_quality,
                obs.all_observations
            FROM hotspots h
            LEFT JOIN LATERAL (
                SELECT source_event_id, instrument, observed_at, brightness_temperature, data_quality_flags
                FROM fire_observations
                WHERE fire_event_id = h.id
                ORDER BY observed_at DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'source', f_obs.source,
                        'instrument', f_obs.instrument,
                        'observed_at', f_obs.observed_at,
                        'confidence', f_obs.confidence,
                        'data_quality_flags', f_obs.data_quality_flags
                    )
                ) as all_observations
                FROM fire_observations f_obs
                WHERE f_obs.fire_event_id = h.id
            ) obs ON true
            WHERE h.id = $1
        """, fire_id)
        
    if not row:
        raise HTTPException(status_code=404, detail="Fire not found")
        
    all_obs_raw = row['all_observations']
    if isinstance(all_obs_raw, str):
        try:
            all_obs_list = json.loads(all_obs_raw)
        except Exception:
            all_obs_list = []
    else:
        all_obs_list = all_obs_raw or []
        
    summary, obs_sources = build_corroboration_summary(all_obs_raw, row['source'])
    
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
        data_quality_flags=row['data_quality'],
        observation_sources=obs_sources
    )
    cls_output = classify_hotspot(data)
    
    # Attach weather context
    weather = get_weather_for_location(row['latitude'], row['longitude'], row['observed_at'] or row['first_observed_at'])
    
    now_utc = datetime.now(timezone.utc)
    data_freshness_mins = None
    if row['observed_at']:
        diff = now_utc - row['observed_at']
        data_freshness_mins = round(diff.total_seconds() / 60)
        
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
            "weather": weather.model_dump(),
            "corroboration": cls_output.corroboration,
            "corroboration_summary": summary,
            "observations_timeline": all_obs_list,
            "data_freshness_mins": data_freshness_mins
        }
    }

@router.get("/fires/{fire_id}/impact")
async def get_fire_impact(request: Request, fire_id: int, radius_m: float = 1000.0):
    """
    Returns potential impact context including nearby assets and downwind status.
    """
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude, last_observed_at as observed_at, first_observed_at
            FROM hotspots
            WHERE id = $1
        """, fire_id)
        
    if not row:
        raise HTTPException(status_code=404, detail="Fire not found")
        
    # Get weather to determine wind direction
    from app.engine.assets import get_impact_context
    weather = get_weather_for_location(row['latitude'], row['longitude'], row['observed_at'] or row['first_observed_at'])
    wind_dir = weather.wind_direction if weather else None
    
    impact = get_impact_context(
        event_id=str(fire_id),
        lat=row['latitude'],
        lon=row['longitude'],
        radius_m=radius_m,
        wind_dir=wind_dir
    )
    
    return impact.model_dump()
