# GeoFlare AI: Prototype Contract

This document outlines the API contracts, data shapes, and UI expectations established in Phase 1. **Subsequent phases MUST preserve these contracts** to ensure the demonstration prototype continues to function reliably.

## 1. GeoJSON Contracts

### Hotspots (`/api/v1/fires`)
The frontend expects a standard `FeatureCollection` where each `Feature` is a `Point` geometry.

**Required Properties:**
```json
{
  "id": 1,
  "observed_at": "2024-01-15T06:30:00Z",
  "confidence": "High",
  "satellite": "MODIS_DEMO_FLARE",
  "temperature": 1200.5,
  "frp": 45.2,
  "alert_status": "new",
  "classification": "industrial_fire_flare",
  "subclass": "gas_flare",
  "classification_confidence": "high",
  "evidence": [
    "Distance to industrial zone is 0m (<= 1000m).",
    "Hotspot is persistent."
  ],
  "explanation": "Human readable string...",
  "distance_to_industrial": 0,
  "facility_type": "Refinery",
  "days_observed": 10,
  "observation_count": 24
}
```

### Industrial Zones (`/api/v1/industrial-zones`)
The frontend expects a `FeatureCollection` of `Polygon` geometries.

**Required Properties:**
```json
{
  "id": 1,
  "name": "Thane-Belapur Petrochemical Plant",
  "facility_type": "Refinery"
}
```

## 2. Classification Strings & Logic

The frontend `Map.tsx`, `AlertCenter.tsx`, and `InvestigationPanel.tsx` rely on specific string normalizations. 

**Valid `classification` strings (Backend Output):**
- `industrial_fire_flare` (or `Industrial Fire/Flare`)
- `natural_vegetation` (or `Natural/Vegetation`)
- `unknown_uncertain` (or `Unknown/Uncertain`)

**Valid `subclass` strings (Backend Output):**
- `gas_flare` (or `Gas Flare`)
- `industrial_fire`
- `wildfire`

*If these strings change in `rules.py`, the frontend normalization maps (`CLS_MAP`, `SUB_MAP`) MUST be updated.*

## 3. Alerts (`/api/v1/alerts/{id}/status`)

The frontend expects a `PATCH` request to update the status of a hotspot.

**Valid `alert_status` strings:**
- `new`
- `acknowledged`
- `investigating`
- `resolved`
- `false_positive`

## 4. Frontend Fallback & Demo Expectations

To guarantee a demo-ready state at all times, the frontend implements strict fallback behaviors:
- If the `/fires` or `/industrial-zones` endpoints fail, timeout, or return 500s, the frontend will automatically load `FALLBACK_FIRES`, `FALLBACK_ZONES`, and `DEMO_ALERTS` arrays defined in the React components.
- The `AlertCenter` and `InvestigationPanel` will display a clear visual indicator (e.g., "Using Demo Data", "Backend unreachable") but will remain fully interactive.
- **Rule:** Do NOT remove this fallback logic. Any future API integrations (e.g., real FIRMS) must fail gracefully back to the demo state.

## 5. UI/Leaflet Interactions

- **Marker Styling:** `Map.tsx` applies red, green, yellow, and orange styles based exclusively on the mapped classification outputs. 
- **1km Halo:** When a hotspot is clicked, the map draws a 1000m radius circle around it. This is hardcoded to visualize the proximity rule.
- **Timeline Slider:** The frontend extracts unique dates from `observed_at` to build a playback slider. Ensure `observed_at` always maintains a valid ISO timestamp format.
