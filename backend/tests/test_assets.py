import pytest
from app.engine.assets import haversine, calculate_bearing, is_downwind, get_impact_context
import math

def test_haversine():
    # Distance between London and Paris should be ~343km
    dist = haversine(51.5074, -0.1278, 48.8566, 2.3522)
    assert math.isclose(dist, 343000, rel_tol=0.05)

def test_bearing():
    # London to Paris bearing is approx 153 degrees
    bearing = calculate_bearing(51.5074, -0.1278, 48.8566, 2.3522)
    assert math.isclose(bearing, 153.5, rel_tol=0.05)

def test_is_downwind():
    # If wind is coming from North (0 degrees), it blows towards South (180).
    # If asset is south, it should be downwind.
    
    # Asset exactly south
    assert is_downwind(0.0, 0.0, -1.0, 0.0, wind_direction_from=0.0) == True
    
    # Asset exactly north
    assert is_downwind(0.0, 0.0, 1.0, 0.0, wind_direction_from=0.0) == False
    
    # Asset west (crosswind)
    assert is_downwind(0.0, 0.0, 0.0, -1.0, wind_direction_from=0.0) == False

def test_get_impact_context_demo_fallback():
    # This should hit the fallback demo generator if the API is mocked or unreachable
    impact = get_impact_context(event_id="test", lat=19.1, lon=73.0, radius_m=1000.0, wind_dir=0.0)
    
    # Assert properties
    assert impact.event_id == "test"
    assert impact.impact_radius_m == 1000.0
    # If it falls back to demo, is_demo should be True, or if real API worked, we check the structure
    if impact.is_demo:
        assert impact.source_status == "Demo Geographic Context (API Unavailable)"
        assert len(impact.assets) == 3
        
        # Check if one of the demo assets is downwind (south of 19.1)
        downwind_assets = [a for a in impact.assets if a.downwind]
        assert len(downwind_assets) > 0
