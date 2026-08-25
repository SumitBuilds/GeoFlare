-- Seed Industrial Facilities (DEMO DATA)
INSERT INTO industrial_facilities (name, facility_type, is_demo_data, location)
VALUES (
    'Thane-Belapur Petrochemical Plant (DEMO DATA)',
    'Refinery',
    true,
    ST_GeogFromText('POLYGON((72.99 19.12, 73.01 19.12, 73.01 19.10, 72.99 19.10, 72.99 19.12))')
);

-- Seed Hotspots
-- 1. Persistent industrial gas flare (Inside the facility bounds)
INSERT INTO hotspots (observed_at, location, confidence, satellite, temperature, frp, days_observed, observation_count)
VALUES (
    CURRENT_TIMESTAMP,
    ST_GeogFromText('POINT(73.00 19.11)'),
    'High',
    'MODIS_DEMO_FLARE',
    1200.5,
    45.2,
    10,
    24
);

-- 2. Natural vegetation fire (Far away, ~8km South East in Kharghar Hills)
INSERT INTO hotspots (observed_at, location, confidence, satellite, temperature, frp, days_observed, observation_count)
VALUES (
    CURRENT_TIMESTAMP,
    ST_GeogFromText('POINT(73.06 19.04)'),
    'Nominal',
    'MODIS_DEMO_VEG',
    600.0,
    12.5,
    1,
    1
);

-- 3. Unknown/uncertain hotspot (~2km South East of facility, outside the 1km halo)
INSERT INTO hotspots (observed_at, location, confidence, satellite, temperature, frp, days_observed, observation_count)
VALUES (
    CURRENT_TIMESTAMP,
    ST_GeogFromText('POINT(73.025 19.09)'),
    'Low',
    'MODIS_DEMO_UNKNOWN',
    400.0,
    5.0,
    2,
    2
);
