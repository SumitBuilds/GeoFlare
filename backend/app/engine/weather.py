from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import hashlib
import math
import httpx
from functools import lru_cache
from app.core.config import OPENWEATHER_API_KEY
import logging

logger = logging.getLogger(__name__)

class WeatherContext(BaseModel):
    source: str
    observed_at: str
    wind_speed: float
    wind_direction: float
    units: str
    is_demo: bool
    data_quality_flags: Optional[str]

@lru_cache(maxsize=128)
def _fetch_live_weather(lat_rounded: float, lon_rounded: float) -> Optional[dict]:
    if not OPENWEATHER_API_KEY:
        return None
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat_rounded}&lon={lon_rounded}&appid={OPENWEATHER_API_KEY}&units=metric"
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch live weather: {e}")
        return None

def get_weather_for_location(lat: float, lon: float, timestamp: datetime) -> WeatherContext:
    """
    Fetches live weather from OpenWeatherMap if configured, otherwise falls back to 
    deterministic demo weather data based on location and time.
    """
    live_data = _fetch_live_weather(round(lat, 1), round(lon, 1))
    
    if live_data and "wind" in live_data:
        wind_speed = float(live_data["wind"].get("speed", 0.0))
        wind_direction = float(live_data["wind"].get("deg", 0.0))
        # OpenWeather map provides data timestamp, but we can just use now
        return WeatherContext(
            source="OpenWeatherMap (Live)",
            observed_at=datetime.utcnow().isoformat(),
            wind_speed=round(wind_speed, 1),
            wind_direction=round(wind_direction, 1),
            units="m/s",
            is_demo=False,
            data_quality_flags="Live weather data."
        )

    # Fallback to deterministic pseudo-random generation based on location and date
    hash_input = f"{lat:.2f}_{lon:.2f}_{timestamp.strftime('%Y-%m-%d')}".encode()
    hash_val = int(hashlib.md5(hash_input).hexdigest(), 16)
    
    # Wind direction (0-360 degrees) - where wind is coming from
    wind_direction = float(hash_val % 360)
    
    # Wind speed (0.5 to 15.0 m/s)
    wind_speed = 0.5 + float((hash_val // 360) % 145) / 10.0
    
    return WeatherContext(
        source="Demo Weather Generator",
        observed_at=timestamp.isoformat(),
        wind_speed=round(wind_speed, 1),
        wind_direction=round(wind_direction, 1),
        units="m/s",
        is_demo=True,
        data_quality_flags="Simulated indicative data only."
    )
