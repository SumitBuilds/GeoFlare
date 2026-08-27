import httpx
import math
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from functools import lru_cache
import os

logger = logging.getLogger(__name__)

OVERPASS_API_URL = os.getenv("OVERPASS_API_URL", "https://overpass-api.de/api/interpreter")

class GeographicAsset(BaseModel):
    id: str
    name: str
    asset_type: str
    latitude: float
    longitude: float
    distance_m: float
    inside_impact_radius: bool
    downwind: bool
    source: str
    is_demo: bool
    observed_at: str
    data_quality_flags: List[str]

class ImpactContext(BaseModel):
    event_id: str
    assets: List[GeographicAsset]
    impact_radius_m: float
    source_status: str
    is_demo: bool
    data_quality_flags: List[str]

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    theta = math.atan2(y, x)
    return (math.degrees(theta) + 360) % 360

def is_downwind(lat1: float, lon1: float, lat2: float, lon2: float, wind_direction_from: float) -> bool:
    downwind_direction = (wind_direction_from + 180) % 360
    bearing = calculate_bearing(lat1, lon1, lat2, lon2)
    diff = abs(bearing - downwind_direction)
    if diff > 180:
        diff = 360 - diff
    return diff <= 25.0

def get_demo_assets(lat: float, lon: float, radius: float, wind_dir: float) -> List[dict]:
    """Generates synthetic demo assets when API fails."""
    # Create a school, hospital, and residential area synthetically
    def offset_latlon(lt, ln, dist_m, bearing):
        R = 6371000
        brng = math.radians(bearing)
        lt1 = math.radians(lt)
        ln1 = math.radians(ln)
        lt2 = math.asin(math.sin(lt1)*math.cos(dist_m/R) + math.cos(lt1)*math.sin(dist_m/R)*math.cos(brng))
        ln2 = ln1 + math.atan2(math.sin(brng)*math.sin(dist_m/R)*math.cos(lt1), math.cos(dist_m/R)-math.sin(lt1)*math.sin(lt2))
        return math.degrees(lt2), math.degrees(ln2)
    
    downwind = (wind_dir + 180) % 360
    
    s_lat, s_lon = offset_latlon(lat, lon, radius * 0.5, downwind)
    h_lat, h_lon = offset_latlon(lat, lon, radius * 0.8, downwind + 15)
    r_lat, r_lon = offset_latlon(lat, lon, radius * 1.5, downwind - 90) # upwind/crosswind
    
    return [
        {"id": "demo-1", "name": "Demo School", "type": "school", "lat": s_lat, "lon": s_lon},
        {"id": "demo-2", "name": "Demo Hospital", "type": "hospital", "lat": h_lat, "lon": h_lon},
        {"id": "demo-3", "name": "Demo Residential Area", "type": "residential", "lat": r_lat, "lon": r_lon},
    ]

@lru_cache(maxsize=128)
def fetch_overpass_assets(lat_round: float, lon_round: float, radius: float) -> Optional[dict]:
    # Construct an Overpass QL query
    query = f"""
    [out:json][timeout:10];
    (
      node["amenity"~"school|hospital|clinic|fire_station|police|fuel"](around:{radius},{lat_round},{lon_round});
      way["landuse"="residential"](around:{radius},{lat_round},{lon_round});
      way["highway"~"primary|trunk|motorway"](around:{radius},{lat_round},{lon_round});
      way["railway"="rail"](around:{radius},{lat_round},{lon_round});
      node["power"~"plant|substation"](around:{radius},{lat_round},{lon_round});
      node["industrial"="chemical"](around:{radius},{lat_round},{lon_round});
    );
    out center;
    """
    try:
        response = httpx.post(OVERPASS_API_URL, data={"data": query}, timeout=12.0)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Overpass API error: {e}")
        return None

def get_impact_context(event_id: str, lat: float, lon: float, radius_m: float, wind_dir: float) -> ImpactContext:
    raw_data = fetch_overpass_assets(round(lat, 3), round(lon, 3), radius_m + 2000) # search a bit wider
    
    assets = []
    is_demo = False
    source_status = "OpenStreetMap (Overpass API)"
    
    if raw_data and "elements" in raw_data:
        for el in raw_data["elements"]:
            el_lat = el.get("lat") or el.get("center", {}).get("lat")
            el_lon = el.get("lon") or el.get("center", {}).get("lon")
            if not el_lat or not el_lon:
                continue
                
            tags = el.get("tags", {})
            name = tags.get("name", "Unnamed Asset")
            
            # Map tags to asset_type
            a_type = "unknown"
            if tags.get("amenity") in ["school", "hospital", "clinic", "fire_station", "police", "fuel"]:
                a_type = tags["amenity"]
            elif tags.get("landuse") == "residential":
                a_type = "residential"
            elif tags.get("highway"):
                a_type = "road"
            elif tags.get("railway"):
                a_type = "railway"
            elif tags.get("power"):
                a_type = "power"
            elif tags.get("industrial") == "chemical":
                a_type = "chemical"
            
            if name == "Unnamed Asset":
                name = f"Unnamed {a_type.capitalize()}"
                
            dist = haversine(lat, lon, el_lat, el_lon)
            if dist > radius_m + 3000:
                continue # ignore very far ones
                
            assets.append(GeographicAsset(
                id=str(el.get("id", "")),
                name=name,
                asset_type=a_type,
                latitude=el_lat,
                longitude=el_lon,
                distance_m=round(dist, 1),
                inside_impact_radius=dist <= radius_m,
                downwind=is_downwind(lat, lon, el_lat, el_lon, wind_dir) if wind_dir is not None else False,
                source="OpenStreetMap",
                is_demo=False,
                observed_at=datetime.utcnow().isoformat(),
                data_quality_flags=[]
            ))
    else:
        is_demo = True
        source_status = "Demo Geographic Context (API Unavailable)"
        demo_items = get_demo_assets(lat, lon, radius_m, wind_dir or 0)
        for item in demo_items:
            dist = haversine(lat, lon, item["lat"], item["lon"])
            assets.append(GeographicAsset(
                id=item["id"],
                name=item["name"],
                asset_type=item["type"],
                latitude=item["lat"],
                longitude=item["lon"],
                distance_m=round(dist, 1),
                inside_impact_radius=dist <= radius_m,
                downwind=is_downwind(lat, lon, item["lat"], item["lon"], wind_dir) if wind_dir is not None else False,
                source="Synthetic Data Generator",
                is_demo=True,
                observed_at=datetime.utcnow().isoformat(),
                data_quality_flags=["Demo geographic context - not verified live data."]
            ))

    return ImpactContext(
        event_id=str(event_id),
        assets=assets,
        impact_radius_m=radius_m,
        source_status=source_status,
        is_demo=is_demo,
        data_quality_flags=["Indicative geospatial assessment, not an official evacuation instruction."]
    )
