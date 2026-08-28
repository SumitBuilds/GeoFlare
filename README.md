# GeoFlare AI
**GeoFlare AI is an explainable geospatial monitoring prototype that helps distinguish industrial thermal anomalies from natural or uncertain events using satellite-style hotspot data, industrial context, spatial distance, persistence, and alert workflows.**

## Overview
GeoFlare AI is a demonstration prototype designed to evaluate the feasibility of explainable, rule-based classification of thermal anomalies. By enriching synthetic hotspot data with industrial infrastructure proximity, this system filters out expected industrial events (like gas flaring) from potential natural disasters (like vegetation fires). 

## Problem Statement
Traditional satellite-based active fire products detect thermal anomalies but often lack the context required to classify the source. This leads to false alarms when industrial facilities (e.g., refineries, steel plants) generate persistent thermal signatures that are flagged as wildfires.

## Proposed Solution
GeoFlare AI introduces a contextual layer by integrating known industrial zones with hotspot data. Through spatial analysis (e.g., proximity within a 1 km halo) and persistence checks, the system provides an explainable classification for every anomaly, reducing alert fatigue and enabling targeted monitoring.

## Key Capabilities
- **Spatial Enrichment:** Evaluates hotspots against known industrial zones using PostGIS distance calculations.
- **Explainable Classification:** Uses deterministic rules to categorize events, providing clear evidence for each decision.
- **Interactive Map:** Visualizes hotspots and industrial polygons using Leaflet and GeoJSON.
- **Alert Workflow:** Generates actionable alerts that can be investigated and updated via an operational dashboard.

## Prototype Scope
This is a **Mini Prototype** built to demonstrate the core workflow (Thermal hotspot → Industrial context → Distance & halo → Explainable classification → Map visualization → Investigation panel → Alert workflow). 

## Current Status
- **Implemented:** Rule-based classification, synthetic demo data ingestion, PostGIS spatial queries, Next.js dashboard, REST API, alert management.
- **Planned:** Live NASA FIRMS ingestion, INSAT-3D/3DR integration, machine learning classification models.

## Important Data Disclaimer
**The current prototype uses synthetic data for demonstration and testing.** The hotspots and industrial facilities provided in the initial setup are labeled as "DEMO DATA" and do not represent live satellite observations or real-world emergencies. Live NASA FIRMS data and INSAT-3D/3DR feeds are planned for future integration but are not currently implemented.

## System Workflow
1. **Data Ingestion:** Synthetic hotspot and industrial zone records are loaded into the database.
2. **Contextualization:** The backend calculates the distance between hotspots and industrial polygons.
3. **Classification:** A rule engine evaluates thermal values, persistence, and proximity to assign a class.
4. **Visualization:** The frontend fetches GeoJSON data and renders it on an interactive map.
5. **Investigation:** Users review the explanation and evidence via the dashboard and manage alert statuses.

## Architecture
- **Frontend:** Next.js, TypeScript, Tailwind CSS, Leaflet, GeoJSON visualization
- **Backend:** FastAPI, PostgreSQL, PostGIS, Explainable rule-based classification, REST API
- **Data:** Synthetic demo hotspot records, synthetic industrial-zone records, satellite-style fields inspired by active-fire products

## Technology Stack
- **Languages:** TypeScript, Python, SQL
- **Frameworks:** Next.js, FastAPI
- **Database:** PostgreSQL with PostGIS extension
- **Mapping:** Leaflet (via react-leaflet)

## Data Sources and Data Types
- **Hotspots:** Modeled after satellite active-fire products (Latitude, Longitude, Brightness, FRP, Confidence). Stored as `GEOGRAPHY(Point, 4326)`.
- **Industrial Zones:** Polygons representing facility boundaries. Stored as `GEOGRAPHY(Polygon, 4326)`.

## Synthetic Demo Data Explanation
To ensure the prototype functions deterministically without external dependencies, it is seeded with synthetic events:
- Persistent industrial gas flares (DEMO DATA)
- Natural vegetation fires (DEMO DATA)
- Unknown/uncertain hotspots (DEMO DATA)

## Classification Logic
The system uses deterministic rules to classify events.

| Classification | Meaning | Typical evidence |
|---|---|---|
| Industrial Fire/Flare | Thermal anomaly associated with industrial infrastructure | Near industrial zone, persistent, high thermal values |
| Natural/Vegetation Fire | Thermal anomaly away from industrial infrastructure | Vegetation/open land context, weaker industrial evidence |
| Unknown/Uncertain | Insufficient or conflicting evidence | Missing data or contradictory signals |

## API Endpoints

### `GET /api/v1/fires`
- **Purpose:** Retrieve a list of classified hotspots.
- **Response Format:** JSON (GeoJSON format supported by the frontend).
- **Example Request:** `GET /api/v1/fires`
- **Example Response Summary:** Returns a list of fire objects including classification, coordinates, and temperature.

### `GET /api/v1/fires/{id}`
- **Purpose:** Retrieve detailed evidence and explanation for a specific hotspot.
- **Response Format:** JSON.
- **Example Request:** `GET /api/v1/fires/1`
- **Example Response Summary:** Returns the full hotspot record, including the explanation string and distance to nearest infrastructure.

### `GET /api/v1/industrial-zones`
- **Purpose:** Retrieve the geographic boundaries of industrial facilities.
- **Response Format:** JSON (GeoJSON format supported by the frontend).
- **Example Request:** `GET /api/v1/industrial-zones`
- **Example Response Summary:** Returns a list of industrial zones with their associated polygon coordinates.

### `GET /api/v1/alerts`
- **Purpose:** Retrieve active alerts generated by the system.
- **Response Format:** JSON.
- **Example Request:** `GET /api/v1/alerts`
- **Example Response Summary:** Returns a list of alerts including severity, related fire ID, and current status.

### `PATCH /api/v1/alerts/{id}/status`
- **Purpose:** Update the operational status of an alert (e.g., from 'open' to 'resolved').
- **Response Format:** JSON.
- **Example Request:** `PATCH /api/v1/alerts/1/status` with payload `{"status": "resolved"}`
- **Example Response Summary:** Returns the updated alert object.

### `GET /api/v1/system/health`
- **Purpose:** Check the operational health of the backend API and database connection.
- **Response Format:** JSON.
- **Example Request:** `GET /api/v1/system/health`
- **Example Response Summary:** `{"status": "healthy", "database": "connected"}`

*(Note: API endpoints dealing with map data return spatial coordinates as `[longitude, latitude]`.)*

## Repository Structure
```text
GeoFlare/
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/
│   ├── app/
│   ├── db/
│   └── tests/
├── docker-compose.yml
├── AGENTS.md
├── PROTOTYPE_PRD.md
└── README.md
```

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose

## Environment Variables
Create a `.env.local` file in the `frontend` directory with the following:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Local Installation
Clone the repository to your local machine:
```powershell
git clone https://github.com/SumitBuilds/GeoFlare.git
cd GeoFlare
```

## How to run the database & load demo data
The PostGIS database and synthetic demo data are configured via Docker Compose.
```powershell
docker compose up -d
```
*(This automatically runs the `backend/db/schema.sql` and `backend/db/seed.sql` files on initialization).*

## How to run the backend
```powershell
cd backend
python -m pip install "fastapi[standard]" uvicorn asyncpg
python -m fastapi dev app/main.py
```
*(The backend API will be available at: http://localhost:8000)*
*(API documentation will be available at: http://localhost:8000/docs)*

## How to run the frontend
Open a new terminal window:
```powershell
cd frontend
npm install
npm run dev
```
*(The frontend will be available at: http://localhost:3000)*

## How to test the application
To run the automated backend tests:
```powershell
cd backend
pip install pytest httpx
pytest
```

## User Demonstration Flow
1. Open the dashboard (http://localhost:3000).
2. View the industrial-zone polygons on the interactive map.
3. View synthetic hotspots plotted around the region.
4. Filter by classification (Industrial Fire/Flare, Natural/Vegetation Fire, Unknown/Uncertain).
5. Click a hotspot on the map.
6. Inspect temperature, FRP, confidence, distance, persistence, evidence, and explanation in the Investigation Panel.
7. Open the alert center.
8. Update an alert status to mark it as resolved or under investigation.
9. *Note: Explain to viewers that the displayed records are synthetic demo data.*

## Classification Examples
- **Industrial Flare:** A hotspot is detected within 500 meters of a known refinery polygon. It has high persistence and high thermal values. The system classifies it as an Industrial Fire/Flare and suppresses emergency alerts.
- **Vegetation Fire:** A hotspot is detected 15 km away from the nearest known industrial facility. The system classifies it as a Natural/Vegetation Fire and triggers an alert.

## Known Limitations
- Synthetic demo data is currently used in place of live feeds.
- No guarantee of immediate fire detection.
- Satellite revisit and processing latency apply to future live data.
- Cloud cover and resolution limitations affect detection capabilities.
- Rule-based classification instead of trained machine learning models.
- Industrial facility mapping limitations (missing unmapped facilities).

## Continuous Integration (CI)
GeoFlare AI uses GitHub Actions for continuous integration. The CI pipeline ensures code quality and functional correctness across the frontend and backend.

### What is tested?
- **Frontend**: Installs dependencies (`npm install`), runs linting (`npm run lint`), and builds the production bundle which includes strict typechecking (`npm run build`).
- **Backend**: Installs dependencies, initializes an ephemeral PostGIS test database with schemas and mock data, and runs the test suite (`pytest`) with mocked external services (NASA FIRMS is bypassed).

### How to inspect workflow results
1. Navigate to the **Actions** tab in your GitHub repository.
2. You will see a list of recent workflow runs (e.g., "CI Pipeline").
3. Click on any run to view its details.
4. From the summary page, click on either the **Frontend Lint & Build** or **Backend Tests** job to view the live terminal output and debug any failures.

A pull request targeting `main` cannot be merged unless all checks pass.

## Known Limitations (continued)
- No production notification integration (e.g., WhatsApp).
- No guarantee that every thermal anomaly is a fire.

## Future Enhancements
- Live NASA FIRMS ingestion.
- INSAT-3D/3DR integration subject to data access.
- Multi-source observation fusion.
- Machine-learning classification.
- Historical analytics.
- Role-based access.
- Production alert channels.
- Improved facility datasets.
- Cloud deployment.
- Audit logging.

## Security Notes
- Never commit `.env.local`.
- Never commit API tokens or database passwords.
- Use environment variables for secrets.
- Restrict public map-provider tokens where applicable.
- Keep demo credentials out of the repository.

## Team Contribution Guidance
- Create a feature branch for your work.
- Make focused, atomic commits.
- Run tests and builds locally before submitting.
- Open a pull request against `main`.
- Do not push directly to `main` unless explicitly agreed upon by the team.

---
*This repository contains a demonstration prototype. It is not a certified emergency-response system and must not be used as the sole basis for operational decisions.*
