from dataclasses import dataclass
from typing import List, Optional

@dataclass
class HotspotInput:
    temperature: float
    frp: float
    confidence: str
    distance_to_industrial: float
    days_observed: int
    observation_count: int
    industrial_zone_type: Optional[str]

@dataclass
class ClassificationOutput:
    classification: str
    subclass: Optional[str]
    confidence: str
    evidence: List[str]
    explanation: str
    rule_version: str

def classify_hotspot(data: HotspotInput) -> ClassificationOutput:
    rule_version = "1.0.0"
    evidence = []
    
    # Thresholds
    is_near_industrial = data.distance_to_industrial <= 1000
    is_far_from_industrial = data.distance_to_industrial > 2000
    is_persistent = data.days_observed >= 3 or data.observation_count >= 5
    
    if is_near_industrial:
        evidence.append(f"Distance to industrial zone is {data.distance_to_industrial}m (<= 1000m).")
    else:
        evidence.append(f"Distance to industrial zone is {data.distance_to_industrial}m (> 1000m).")
        
    if is_persistent:
        evidence.append(f"Hotspot is persistent (observed for {data.days_observed} days, {data.observation_count} times).")
    
    # Rule 1: Industrial Fire/Flare
    if is_near_industrial and is_persistent:
        subclass = "gas_flare" if data.industrial_zone_type and data.industrial_zone_type.lower() == "refinery" else "industrial_fire"
        evidence.append(f"Located within 1km of industrial zone of type '{data.industrial_zone_type}'.")
        return ClassificationOutput(
            classification="industrial_fire_flare",
            subclass=subclass,
            confidence="high",
            evidence=evidence,
            explanation="Hotspot is persistent and located very close to an industrial facility, strongly indicating an industrial flare or fire.",
            rule_version=rule_version
        )
        
    # Rule 2: Natural Vegetation
    if is_far_from_industrial and not is_persistent and data.confidence.lower() in ["nominal", "high"]:
        evidence.append("Not persistent and located far (>2km) from known industrial infrastructure.")
        return ClassificationOutput(
            classification="natural_vegetation",
            subclass="wildfire",
            confidence=data.confidence.lower(), 
            evidence=evidence,
            explanation="Hotspot is far from industrial areas and lacks long-term persistence, consistent with a natural vegetation fire.",
            rule_version=rule_version
        )
        
    # Rule 3: Unknown/Uncertain (Fallback or Conflicting Evidence)
    if is_near_industrial and not is_persistent:
        evidence.append("Conflicting evidence: near industrial zone but lacks expected persistence.")
    elif not is_far_from_industrial and not is_near_industrial:
        evidence.append("Located in the buffer zone (1km - 2km) from industrial areas.")
        
    return ClassificationOutput(
        classification="unknown_uncertain",
        subclass=None,
        confidence="low",
        evidence=evidence,
        explanation="Evidence is conflicting, borderline, or insufficient to confidently classify as natural or industrial.",
        rule_version=rule_version
    )
