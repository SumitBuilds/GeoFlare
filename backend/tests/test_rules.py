from app.engine.rules import HotspotInput, classify_hotspot

def test_industrial_event():
    data = HotspotInput(
        temperature=350.0,
        brightness_temperature=330.0,
        frp=25.0,
        confidence="nominal",
        distance_to_industrial=500.0,
        days_observed=5,
        observation_count=10,
        industrial_zone_type="Refinery",
        approx_movement=100.0,
        persistence_confidence=2.0,
        data_quality_flags="0"
    )
    result = classify_hotspot(data)
    assert result.classification == "industrial_thermal_source"
    assert result.subclass == "gas_flare"
    assert result.severity in ["Moderate", "High"]
    assert result.prototype_risk_score > 0
    assert "proximity_risk" in result.score_components
    assert result.score_components["proximity_risk"] == 30.0

def test_natural_event():
    data = HotspotInput(
        temperature=320.0,
        brightness_temperature=310.0,
        frp=15.0,
        confidence="high",
        distance_to_industrial=3000.0,
        days_observed=1,
        observation_count=1,
        industrial_zone_type=None,
        approx_movement=600.0,
        persistence_confidence=0.5,
        data_quality_flags="0",
        land_cover_type="forest"
    )
    result = classify_hotspot(data)
    assert result.classification == "wildfire_forest_fire"
    assert result.subclass is None
    assert result.score_components["proximity_risk"] == 0.0

def test_unknown_event_conflict():
    # Near industrial, but not persistent and moving fast
    data = HotspotInput(
        temperature=320.0,
        brightness_temperature=310.0,
        frp=15.0,
        confidence="nominal",
        distance_to_industrial=800.0,
        days_observed=1,
        observation_count=1,
        industrial_zone_type="Manufacturing",
        approx_movement=1200.0,
        persistence_confidence=0.1,
        data_quality_flags="0"
    )
    result = classify_hotspot(data)
    assert result.classification == "industrial_thermal_source"
    assert result.classification_confidence == "low"

def test_missing_optional_fields():
    data = HotspotInput(
        temperature=320.0,
        brightness_temperature=0.0,
        frp=0.0,
        confidence="low",
        distance_to_industrial=5000.0,
        days_observed=1,
        observation_count=1,
        industrial_zone_type=None,
        approx_movement=0.0,
        persistence_confidence=0.0,
        data_quality_flags=None
    )
    result = classify_hotspot(data)
    assert result.classification == "unknown_uncertain"

def test_low_confidence_event():
    data = HotspotInput(
        temperature=300.0,
        brightness_temperature=300.0,
        frp=5.0,
        confidence="low",
        distance_to_industrial=2500.0,
        days_observed=1,
        observation_count=1,
        industrial_zone_type=None,
        approx_movement=100.0,
        persistence_confidence=1.0,
        data_quality_flags="Some issue"
    )
    result = classify_hotspot(data)
    assert result.classification == "unknown_uncertain"
    assert "Some issue" in result.data_quality_flags

def test_corroboration_levels():
    from app.engine.rules import calculate_corroboration
    
    assert calculate_corroboration([]) == "Weak"
    assert calculate_corroboration(["NASA_FIRMS:VIIRS"]) == "Weak"
    assert calculate_corroboration(["NASA_FIRMS:VIIRS", "NASA_FIRMS:MODIS"]) == "Partial"
    assert calculate_corroboration(["NASA_FIRMS:VIIRS", "NASA_FIRMS:MODIS", "ESA:Sentinel"]) == "Strong"
    assert calculate_corroboration([]) == "Weak"
