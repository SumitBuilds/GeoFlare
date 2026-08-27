# GeoFlare AI: Phase 1 Repository Audit

*Generated during Phase 1 Finalization.*

## Overview
The GeoFlare AI prototype is currently in a functional demo state, built to showcase the core alert and investigation loop for thermal anomalies. It relies entirely on synthetic demo data seeded into a PostGIS database, with a robust frontend fallback mechanism.

## 1. Frontend & Leaflet Map
- **Stack:** Next.js (React 19), Tailwind CSS, Lucide React.
- **Map Implementation:** Uses raw `leaflet` directly within `Map.tsx` via `useEffect` hooks, rather than wrapper libraries like `react-leaflet`. It utilizes CartoDB Dark Matter tiles.
- **Features:** 
  - Dynamic marker styling (color and abbreviation) based on hotspot classification.
  - 1 km distance halo on selected hotspots.
  - Timeline slider for observation dates.
  - Graceful fallback: the map handles API failures by loading synthetic GeoJSON fallback data.

## 2. Backend API
- **Stack:** FastAPI, `asyncpg`.
- **Routes (`api/v1/`):**
  - `GET /fires` & `GET /fires/{id}`: Returns GeoJSON FeatureCollections/Features. Runs PostGIS `ST_Distance` calculations in the SQL query and passes results through the Python rules engine before serialization.
  - `PATCH /alerts/{id}/status`: Updates the alert state.
  - `GET /industrial-zones`: (Implied by frontend fetch) returns industrial zone polygons.

## 3. Database & Seed Data
- **Engine:** PostgreSQL with PostGIS 3.3.
- **Schema:** 
  - `industrial_facilities` (`GEOGRAPHY(Polygon)`)
  - `hotspots` (`GEOGRAPHY(Point)`)
- **Demo Data:** `seed.sql` populates 3 industrial zones and 18 hotspots designed to explicitly trigger all classification edge cases (Industrial Fires, Natural Vegetation Fires, Unknown Events).

## 4. Classification Logic
- Located in `backend/app/engine/rules.py`.
- **Logic:** Deterministic rule-based engine heavily reliant on:
  - `distance_to_industrial`: Proximity to the nearest industrial facility.
  - Persistence: `days_observed` and `observation_count`.
- **Output:** Outputs a primary classification, subclass, confidence string, a list of evidence strings, and a readable explanation.

## 5. Investigation Panel & Alert Center
- **Alert Center (`AlertCenter.tsx`):** A dashboard displaying summary statistics, status/class filters, and a grid of alert cards. Fully functional with or without the backend (using fallback data).
- **Investigation Panel (`InvestigationPanel.tsx`):** A slide-out map drawer detailing the proximity, temperature, FRP, and classification evidence of a selected hotspot. Contains buttons to update alert status (e.g., Acknowledge, Resolve).

## 6. Environment, Secrets, & CI/CD
- **Config:** A hardcoded default `DATABASE_URL` exists in `main.py`. No formal `.env` setup or external API keys (FIRMS, Weather, WhatsApp) are currently present.
- **Docker:** A `docker-compose.yml` stands up the PostgreSQL/PostGIS database. No Dockerfiles for the API or Next.js app.
- **CI/CD:** No GitHub Actions or other CI pipelines are configured.

## 7. Tests
- **Frontend:** No test suite configured.
- **Backend:** `pytest` is used for `test_api.py` and `test_rules.py`.

## 8. Working Features vs Gaps
- **Working:** The core operational dashboard demo. The map visualizes hotspots, the rules engine successfully classifies them, and the user can investigate and manage alerts.
- **Gaps (To be addressed):** 
  - Real FIRMS data ingestion (currently synthetic).
  - Real weather data integration (wind speed/direction).
  - Risk scoring and broader impact context (population density, critical infrastructure).

## 9. Risks & Recommendations
- **Risks:** The prototype is heavily coupled to the raw SQL `ST_Distance` calculations in `fires.py` and the exact string outputs of `rules.py` expected by the frontend. Modifying these without updating both ends will break the demo.
- **Recommended Next Steps (Phase 2):** Implement a background task (e.g., `apscheduler`) for real FIRMS CSV polling and integrate Open-Meteo for wind data, updating `HotspotInput` and `schema.sql` to support these new fields while preserving the fallback mechanisms.
