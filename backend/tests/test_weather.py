import pytest
from datetime import datetime
from unittest.mock import patch
from app.engine.weather import get_weather_for_location

@patch("app.engine.weather.OPENWEATHER_API_KEY", "")
def test_weather_generation_validity():
    lat, lon = 19.1, 72.9
    dt = datetime(2023, 1, 1)
    
    weather = get_weather_for_location(lat, lon, dt)
    
    assert weather.wind_speed >= 0.5
    assert weather.wind_speed <= 15.0
    assert weather.wind_direction >= 0.0
    assert weather.wind_direction < 360.0
    assert weather.is_demo is True
    assert weather.units == "m/s"
    assert "Demo Weather Generator" in weather.source
    assert "Simulated indicative data only" in weather.data_quality_flags

@patch("app.engine.weather.OPENWEATHER_API_KEY", "")
def test_weather_deterministic():
    lat, lon = 19.1, 72.9
    dt = datetime(2023, 1, 1)
    
    weather1 = get_weather_for_location(lat, lon, dt)
    weather2 = get_weather_for_location(lat, lon, dt)
    
    assert weather1.wind_direction == weather2.wind_direction
    assert weather1.wind_speed == weather2.wind_speed

def test_direction_conversion_logic():
    # Test the logic that the frontend uses
    def get_downwind(wind_direction):
        return (wind_direction + 180) % 360
        
    assert get_downwind(0) == 180 # North wind blows South
    assert get_downwind(90) == 270 # East wind blows West
    assert get_downwind(180) == 0 # South wind blows North
    assert get_downwind(270) == 90 # West wind blows East
    assert get_downwind(359) == 179 # Just below 360
