from dataclasses import dataclass, field
from typing import List, Optional, Dict

@dataclass
class HotspotInput:
    temperature: float
    brightness_temperature: float
    frp: float
    confidence: str
    distance_to_industrial: float
    days_observed: int
    observation_count: int
    industrial_zone_type: Optional[str]
    approx_movement: float
    persistence_confidence: float
    data_quality_flags: Optional[str]
    observation_sources: List[str] = field(default_factory=list)

@dataclass
class ClassificationOutput:
    classification: str
    subclass: Optional[str]
    confidence: str
    evidence: List[str]
    explanation: str
    rule_version: str
    risk_score: float
    severity: str
    score_components: Dict[str, float]
    corroboration: str = "Weak"

def calculate_corroboration(sources: List[str]) -> str:
    # sources is a list of strings like 'NASA_FIRMS:VIIRS', 'Synthetic Demo', etc.
    # We count unique satellites/instruments.
    # Note: 'Synthetic Demo' counts as 1 source if present.
    unique_sources = set()
    for src in sources:
        if not src:
            continue
        unique_sources.add(src)
        
    count = len(unique_sources)
    if count >= 3:
        return "Strong"
    elif count == 2:
        return "Partial"
    return "Weak"

def classify_hotspot(data: HotspotInput) -> ClassificationOutput:
    rule_version = "2.0.0"
    evidence = []
    score_components = {}
    
    # 1. Base factors
    is_near_industrial = data.distance_to_industrial <= 1000
    is_far_from_industrial = data.distance_to_industrial > 2000
    is_persistent = data.days_observed >= 3 or data.observation_count >= 5
    is_stationary = data.approx_movement <= 500  # less than 500m movement is considered stationary
    
    if is_near_industrial:
        evidence.append(f"Distance to industrial zone is {data.distance_to_industrial}m (<= 1000m).")
        score_components["proximity_risk"] = 30.0
    elif not is_far_from_industrial:
        evidence.append(f"Located in buffer zone ({data.distance_to_industrial}m) from industrial areas.")
        score_components["proximity_risk"] = 15.0
    else:
        evidence.append(f"Distance to industrial zone is {data.distance_to_industrial}m (> 1000m).")
        score_components["proximity_risk"] = 0.0
        
    if is_persistent:
        evidence.append(f"Hotspot is persistent (observed for {data.days_observed} days, {data.observation_count} times, confidence {data.persistence_confidence:.1f}).")
        
    if is_stationary:
        evidence.append(f"Hotspot exhibits stationary behavior (moved {data.approx_movement:.1f}m).")
    else:
        evidence.append(f"Hotspot has moved significantly ({data.approx_movement:.1f}m).")

    if data.data_quality_flags and data.data_quality_flags != "0":
        evidence.append(f"Data quality flags present: {data.data_quality_flags}.")
        
    corroboration = calculate_corroboration(data.observation_sources)
    evidence.append(f"Source Corroboration: {corroboration} ({len(set(data.observation_sources))} unique sources).")
        
    # Calculate Risk Score (Not a probability, 0-100 scale)
    # FRP contribution (max 40)
    frp_score = min(data.frp / 10.0, 40.0) 
    score_components["frp_score"] = frp_score
    
    # Temp contribution (max 30)
    temp_score = min(data.brightness_temperature / 15.0, 30.0)
    score_components["temp_score"] = temp_score
    
    risk_score = round(score_components.get("proximity_risk", 0.0) + frp_score + temp_score, 1)
    risk_score = min(risk_score, 100.0)
    
    # Severity thresholds
    if risk_score <= 25:
        severity = "Low"
    elif risk_score <= 50:
        severity = "Moderate"
    elif risk_score <= 75:
        severity = "High"
    else:
        severity = "Critical"
    
    # Classification Logic
    
    # Rule 1: Industrial Fire/Flare
    if is_near_industrial and is_persistent and is_stationary:
        subclass = "gas_flare" if data.industrial_zone_type and data.industrial_zone_type.lower() == "refinery" else "industrial_fire"
        evidence.append(f"Located within 1km of industrial zone of type '{data.industrial_zone_type}'.")
        return ClassificationOutput(
            classification="industrial_fire_flare",
            subclass=subclass,
            confidence="high",
            evidence=evidence,
            explanation="Hotspot is persistent, stationary, and located very close to an industrial facility.",
            rule_version=rule_version,
            risk_score=risk_score,
            severity=severity,
            score_components=score_components,
            corroboration=corroboration
        )
        
    # Rule 2: Natural Vegetation
    if is_far_from_industrial and not is_persistent and data.confidence.lower() in ["nominal", "high"]:
        evidence.append("Not persistent and located far from known industrial infrastructure.")
        return ClassificationOutput(
            classification="natural_vegetation",
            subclass="wildfire",
            confidence=data.confidence.lower(), 
            evidence=evidence,
            explanation="Hotspot is far from industrial areas and lacks long-term persistence.",
            rule_version=rule_version,
            risk_score=risk_score,
            severity=severity,
            score_components=score_components,
            corroboration=corroboration
        )
        
    # Rule 3: Unknown/Uncertain
    evidence.append("Evidence is conflicting, borderline, or missing.")
    return ClassificationOutput(
        classification="unknown_uncertain",
        subclass=None,
        confidence="low",
        evidence=evidence,
        explanation="Insufficient or conflicting evidence to classify definitively.",
        rule_version=rule_version,
        risk_score=risk_score,
        severity=severity,
        score_components=score_components,
        corroboration=corroboration
    )
