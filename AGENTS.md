# GeoFlare AI Agent Instructions

## Mission

Build a reliable, demo-first mini prototype for GeoFlare AI.

The core demonstration is:

Thermal hotspot
→ Industrial context
→ Distance and 1 km halo
→ Explainable classification
→ Map visualization
→ Investigation panel
→ Alert workflow

## Important Rule

Build the project in small, testable phases.

NEVER implement the entire application at once.

Before coding each phase:

1. Explain what will be changed.
2. List files that will change.
3. List required dependencies.
4. List required environment variables.
5. Explain how the feature will be tested.

After coding:

1. Run relevant tests.
2. Run lint/type checks where applicable.
3. Explain changed files.
4. Explain how to run the feature.
5. Report errors honestly.
6. Explain what should be manually verified.
7. Stop and wait for the next instruction.

## Mini Prototype Priority

Priority order:

1. Demo data
2. Classification logic
3. API
4. Map
5. Investigation panel
6. Alerts
7. Polish

## Demo-First Requirement

The prototype must work without:

- NASA FIRMS
- INSAT
- Random Forest
- WhatsApp
- Authentication
- External notification services

Seeded demo data is mandatory.

## Required Demo Events

Include:

1. Persistent industrial gas flare
2. Natural vegetation fire
3. Unknown/uncertain hotspot

All seeded facilities must be labelled DEMO DATA.

## Classifications

- Industrial Fire/Flare
- Natural/Vegetation Fire
- Unknown/Uncertain

Optional subclass:

- Gas Flare

## Classification Rule

Use deterministic and explainable rules for the mini prototype.

Never force conflicting evidence into Industrial or Natural.

## GIS Rules

Use PostGIS geography types where practical.

Use:

- GEOGRAPHY(Point, 4326) for hotspots
- GEOGRAPHY(Polygon, 4326) for industrial zones
- ST_Distance for metres
- ST_DWithin for the 1 km halo
- GeoJSON for map data

Never calculate geographic distance by subtracting latitude and longitude.

## Frontend

Use:

- Next.js
- TypeScript
- Tailwind CSS
- Mapbox GL JS

The frontend should use a dark operational dashboard.

Classification display:

- Industrial Fire/Flare: red
- Gas Flare: orange
- Natural/Vegetation: green
- Unknown/Uncertain: yellow

Do not rely only on colour. Use labels and text too.

## Do Not Build Today

Do not start advanced features before the mini prototype works.

Do not build:

- CNN
- Random Forest training
- Live FIRMS integration
- INSAT integration
- WhatsApp integration
- Nationwide processing
- Mobile app
- Kubernetes
- Complex microservices
- Automatic emergency dispatch
- Advanced authentication

## Safety Against Uncontrolled Changes

Do not delete working files.

Do not rewrite unrelated files.

Do not change the API contract without explicit approval.

Do not add unnecessary dependencies.

Do not invent real-world industrial facilities.

Clearly label seeded facilities as DEMO DATA.

## Current Goal

Today's goal is ONLY the working mini prototype.

Stop after each phase and wait for the next instruction.