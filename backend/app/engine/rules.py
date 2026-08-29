from dataclasses import dataclass, field
from typing import List, Optional, Dict

@dataclass
class HotspotInput:
    temperature: float
    brightness_temperature: float
    frp: float
    confidence: str  # FIRMS detection confidence
    distance_to_industrial: float
    days_observed: int
    observation_count: int
    industrial_zone_type: Optional[str]
    approx_movement: float
    persistence_confidence: float
    data_quality_flags: Optional[str]
    observation_sources: List[str] = field(default_factory=list)
    land_cover_type: Optional[str] = None
    agricultural_context: Optional[str] = None
    is_demo: bool = False

@dataclass
class ClassificationOutput:
    classification: str
    classification_label: str
    subclass: Optional[str]
    classification_confidence: str
    classification_method: str
    model_probability: Optional[float]
    prototype_risk_score: float
    taxonomy_version: str
    evidence: List[str]
    explanation: str
    severity: str
    score_components: Dict[str, float]
    original_classification: Optional[str]
    corroboration: str = "Weak"
    data_quality_flags: List[str] = field(default_factory=list)

def calculate_corroboration(sources: List[str]) -> str:
    unique_sources = set([src for src in sources if src])
    count = len(unique_sources)
    if count >= 3:
        return "Strong"
    elif count == 2:
        return "Partial"
    return "Weak"

def classify_hotspot(data: HotspotInput, original_classification: Optional[str] = None) -> ClassificationOutput:
    taxonomy_version = "geoflare-classification-v2"
    classification_method = "explainable_rules"
    model_probability = None
    
    evidence = []
    score_components = {}
    data_quality = []
    
    # 1. Base factors
    is_near_industrial = data.distance_to_industrial <= 1000
    is_far_from_industrial = data.distance_to_industrial > 2000
    is_persistent = data.days_observed >= 3 or data.observation_count >= 5
    is_stationary = data.approx_movement <= 500
    
    if is_near_industrial:
        evidence.append(f"Located within {data.distance_to_industrial}m of industrial infrastructure.")
        score_components["proximity_risk"] = 30.0
    elif not is_far_from_industrial:
        evidence.append(f"Located in buffer zone ({data.distance_to_industrial}m) from industrial areas.")
        score_components["proximity_risk"] = 15.0
    else:
        evidence.append(f"Distance to industrial zone is {data.distance_to_industrial}m (> 1000m).")
        score_components["proximity_risk"] = 0.0
        
    if is_persistent:
        evidence.append(f"Persistent (observed for {data.days_observed} days, {data.observation_count} times).")
        
    if is_stationary:
        evidence.append(f"Stationary behavior (moved {data.approx_movement:.1f}m).")

    if data.data_quality_flags and data.data_quality_flags != "0":
        data_quality.append(data.data_quality_flags)
        
    if not data.land_cover_type and not data.agricultural_context:
        data_quality.append("missing_land_cover_context")
        
    corroboration = calculate_corroboration(data.observation_sources)
    
    # Calculate Prototype Risk Score (0-100 scale, NOT a probability)
    frp_score = min(data.frp / 10.0, 40.0) 
    score_components["frp_score"] = frp_score
    temp_score = min(data.brightness_temperature / 15.0, 30.0)
    score_components["temp_score"] = temp_score
    
    prototype_risk_score = round(score_components.get("proximity_risk", 0.0) + frp_score + temp_score, 1)
    prototype_risk_score = min(prototype_risk_score, 100.0)
    
    if prototype_risk_score <= 25:
        severity = "Low"
    elif prototype_risk_score <= 50:
        severity = "Moderate"
    elif prototype_risk_score <= 75:
        severity = "High"
    else:
        severity = "Critical"
    
    # --- Classification Logic ---
    
    # Rule 1: Industrial Fire/Thermal Source
    if is_near_industrial:
        subclass = None
        if is_persistent and is_stationary and data.industrial_zone_type and data.industrial_zone_type.lower() == "refinery":
            subclass = "gas_flare"
            evidence.append("Persistent and stationary within a refinery zone.")
            cls_confidence = "high"
            explanation = "Likely Industrial Fire/Thermal Source (Gas Flare): Strong persistence and stationary behavior near verified infrastructure."
        elif is_persistent and is_stationary:
            subclass = "other_industrial_heat"
            cls_confidence = "high"
            explanation = "Likely Industrial Fire/Thermal Source: Persistent and stationary near verified infrastructure."
        else:
            cls_confidence = "low"
            explanation = "Likely Industrial Fire/Thermal Source (Unconfirmed): New high-intensity hotspot near industrial infrastructure, requiring analyst review."
            
        return ClassificationOutput(
            classification="industrial_thermal_source",
            classification_label="Industrial Fire/Thermal Source",
            subclass=subclass,
            classification_confidence=cls_confidence,
            classification_method=classification_method,
            model_probability=model_probability,
            prototype_risk_score=prototype_risk_score,
            taxonomy_version=taxonomy_version,
            evidence=evidence,
            explanation=explanation,
            severity=severity,
            score_components=score_components,
            original_classification=original_classification,
            corroboration=corroboration,
            data_quality_flags=data_quality
        )
        
    # Check land cover for Wildfire / Agricultural.
    # We NEVER classify as wildfire or agricultural solely because it's far from industry.
    if data.land_cover_type in ["forest", "woodland", "grassland", "vegetation"]:
        subclass = None
        evidence.append(f"Located in confirmed {data.land_cover_type} context.")
        return ClassificationOutput(
            classification="wildfire_forest_fire",
            classification_label="Wildfire/Forest Fire",
            subclass=subclass,
            classification_confidence="moderate" if corroboration != "Strong" else "high",
            classification_method=classification_method,
            model_probability=model_probability,
            prototype_risk_score=prototype_risk_score,
            taxonomy_version=taxonomy_version,
            evidence=evidence,
            explanation=f"Likely Wildfire/Forest Fire: Thermal anomaly detected in {data.land_cover_type} context.",
            severity=severity,
            score_components=score_components,
            original_classification=original_classification,
            corroboration=corroboration,
            data_quality_flags=data_quality
        )
        
    if data.agricultural_context == "agricultural_land":
        subclass = None
        evidence.append("Located in confirmed agricultural land context.")
        return ClassificationOutput(
            classification="agricultural_burning",
            classification_label="Agricultural Burning",
            subclass=subclass,
            classification_confidence="moderate" if corroboration != "Strong" else "high",
            classification_method=classification_method,
            model_probability=model_probability,
            prototype_risk_score=prototype_risk_score,
            taxonomy_version=taxonomy_version,
            evidence=evidence,
            explanation="Likely Agricultural Burning: Thermal anomaly detected in agricultural context.",
            severity=severity,
            score_components=score_components,
            original_classification=original_classification,
            corroboration=corroboration,
            data_quality_flags=data_quality
        )
        
    # Heuristic Fallback for Live Data without Land Cover Metadata
    if is_far_from_industrial:
        if data.frp >= 5.0:
            evidence.append("Heuristic classification: High intensity (FRP >= 5) and far from industrial zones (> 2km).")
            return ClassificationOutput(
                classification="wildfire_forest_fire",
                classification_label="Wildfire/Forest Fire",
                subclass=None,
                classification_confidence="low",
                classification_method=classification_method,
                model_probability=model_probability,
                prototype_risk_score=prototype_risk_score,
                taxonomy_version=taxonomy_version,
                evidence=evidence,
                explanation="Heuristic: Likely Wildfire due to higher thermal intensity far from known industry.",
                severity=severity,
                score_components=score_components,
                original_classification=original_classification,
                corroboration=corroboration,
                data_quality_flags=data_quality
            )
        else:
            evidence.append("Heuristic classification: Low intensity (FRP < 5) and far from industrial zones (> 2km).")
            return ClassificationOutput(
                classification="agricultural_burning",
                classification_label="Agricultural Burning",
                subclass=None,
                classification_confidence="low",
                classification_method=classification_method,
                model_probability=model_probability,
                prototype_risk_score=prototype_risk_score,
                taxonomy_version=taxonomy_version,
                evidence=evidence,
                explanation="Heuristic: Likely Agricultural Burning due to low thermal intensity far from known industry.",
                severity=severity,
                score_components=score_components,
                original_classification=original_classification,
                corroboration=corroboration,
                data_quality_flags=data_quality
            )
            
    # Rule Fallback: Unknown/Uncertain
    evidence.append("Missing or conflicting geographic/land-cover context.")
    explanation = "Unknown/Uncertain: Missing geographic context or land-cover evidence to confirm the nature of the thermal source."
    
    # Old backward compatibility logic: if original was Natural/Vegetation but missing land cover context.
    if original_classification in ["natural_vegetation", "Natural/Vegetation Fire", "Natural/Vegetation"]:
        evidence.append("Legacy 'Natural/Vegetation Fire' record mapped to Unknown/Uncertain due to missing forest/vegetation evidence.")

    return ClassificationOutput(
        classification="unknown_uncertain",
        classification_label="Unknown/Uncertain",
        subclass=None,
        classification_confidence="unknown",
        classification_method=classification_method,
        model_probability=model_probability,
        prototype_risk_score=prototype_risk_score,
        taxonomy_version=taxonomy_version,
        evidence=evidence,
        explanation=explanation,
        severity=severity,
        score_components=score_components,
        original_classification=original_classification,
        corroboration=corroboration,
        data_quality_flags=data_quality
    )
