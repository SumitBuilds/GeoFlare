-- Seed Industrial Facilities (DEMO DATA)
INSERT INTO industrial_facilities (id, name, facility_type, is_demo_data, location)
VALUES 
(1, 'Thane-Belapur Petrochemical Plant (DEMO DATA)', 'Refinery', true, ST_GeogFromText('POLYGON((72.99 19.12, 73.01 19.12, 73.01 19.10, 72.99 19.10, 72.99 19.12))')),
(2, 'Navi Mumbai Steel Works (DEMO DATA)', 'Steel Plant', true, ST_GeogFromText('POLYGON((73.10 19.07, 73.12 19.07, 73.12 19.05, 73.10 19.05, 73.10 19.07))')),
(3, 'Mahape Manufacturing Hub (DEMO DATA)', 'Manufacturing', true, ST_GeogFromText('POLYGON((73.015 19.115, 73.025 19.115, 73.025 19.105, 73.015 19.105, 73.015 19.115))'))
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    facility_type = EXCLUDED.facility_type, 
    location = EXCLUDED.location;

-- Reset sequence
SELECT setval('industrial_facilities_id_seq', (SELECT MAX(id) FROM industrial_facilities));

-- Seed Hotspots
INSERT INTO hotspots (id, observed_at, location, confidence, satellite, temperature, frp, days_observed, observation_count, alert_status, source)
VALUES 
-- ORIGINAL 3 EVENTS
(1, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.00 19.11)'), 'High', 'MODIS_DEMO_FLARE', 1200.5, 45.2, 10, 24, 'new', 'synthetic_demo'),
(2, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.06 19.04)'), 'Nominal', 'MODIS_DEMO_VEG', 600.0, 12.5, 1, 1, 'new', 'synthetic_demo'),
(3, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.025 19.09)'), 'Low', 'MODIS_DEMO_UNKNOWN', 400.0, 5.0, 2, 2, 'new', 'synthetic_demo'),

-- INDUSTRIAL FIRE/FLARE (5 events)
(4, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.005 19.115)'), 'High', 'MODIS_DEMO_FLARE', 1500.0, 60.0, 30, 100, 'new', 'synthetic_demo'),
(5, CURRENT_TIMESTAMP - INTERVAL '1 day', ST_GeogFromText('POINT(73.11 19.06)'), 'High', 'MODIS_DEMO_FLARE', 1800.0, 80.0, 15, 45, 'new', 'synthetic_demo'),
(6, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.02 19.11)'), 'Nominal', 'MODIS_DEMO_FLARE', 1000.0, 40.0, 5, 12, 'new', 'synthetic_demo'),
(7, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(72.99 19.12)'), 'High', 'MODIS_DEMO_FLARE', 800.0, 25.0, 1, 2, 'new', 'synthetic_demo'),
(8, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.105 19.065)'), 'High', 'MODIS_DEMO_FLARE', 900.0, 30.0, 1, 1, 'new', 'synthetic_demo'),

-- NATURAL/VEGETATION FIRE (5 events)
(9, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.05 19.03)'), 'Nominal', 'MODIS_DEMO_VEG', 500.0, 15.0, 4, 8, 'new', 'synthetic_demo'),
(10, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.15 18.99)'), 'Low', 'MODIS_DEMO_VEG', 400.0, 3.0, 1, 1, 'new', 'synthetic_demo'),
(11, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.11 18.89)'), 'Nominal', 'MODIS_DEMO_VEG', 550.0, 10.0, 1, 2, 'new', 'synthetic_demo'),
(12, CURRENT_TIMESTAMP - INTERVAL '2 days', ST_GeogFromText('POINT(73.25 19.00)'), 'High', 'MODIS_DEMO_VEG', 800.0, 40.0, 1, 3, 'new', 'synthetic_demo'),
(13, CURRENT_TIMESTAMP - INTERVAL '5 days', ST_GeogFromText('POINT(72.95 18.88)'), 'Low', 'MODIS_DEMO_VEG', 350.0, 2.0, 1, 1, 'new', 'synthetic_demo'),

-- UNKNOWN/UNCERTAIN (5 events)
(14, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.035 19.11)'), 'Low', 'MODIS_DEMO_UNKNOWN', 450.0, 8.0, 2, 2, 'new', 'synthetic_demo'),
(15, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(72.98 19.13)'), 'Nominal', 'MODIS_DEMO_UNKNOWN', 600.0, 12.0, 1, 1, 'new', 'synthetic_demo'),
(16, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(73.08 19.06)'), 'Low', 'MODIS_DEMO_UNKNOWN', 380.0, 4.0, 3, 3, 'new', 'synthetic_demo'),
(17, CURRENT_TIMESTAMP - INTERVAL '12 hours', ST_GeogFromText('POINT(72.99 19.07)'), 'Low', 'MODIS_DEMO_UNKNOWN', 320.0, 1.0, 1, 1, 'new', 'synthetic_demo'),
(18, CURRENT_TIMESTAMP, ST_GeogFromText('POINT(72.99 19.15)'), 'Low', 'MODIS_DEMO_UNKNOWN', 410.0, 5.0, 2, 3, 'new', 'synthetic_demo')
ON CONFLICT (id) DO UPDATE SET 
    observed_at = EXCLUDED.observed_at,
    location = EXCLUDED.location,
    confidence = EXCLUDED.confidence,
    satellite = EXCLUDED.satellite,
    temperature = EXCLUDED.temperature,
    frp = EXCLUDED.frp,
    days_observed = EXCLUDED.days_observed,
    observation_count = EXCLUDED.observation_count,
    alert_status = EXCLUDED.alert_status,
    source = EXCLUDED.source;

-- Reset sequence
SELECT setval('hotspots_id_seq', (SELECT MAX(id) FROM hotspots));

-- Seed Fire Observations (1 per hotspot)
INSERT INTO fire_observations (fire_event_id, source, source_event_id, instrument, acq_time, brightness_temperature, temperature, frp, confidence, location, data_quality)
SELECT 
    id, 'synthetic_demo', 'DEMO_EVT_' || id, satellite, observed_at, temperature + 15.0, temperature, frp, confidence, location, 'nominal'
FROM hotspots;

-- Seed Source Health
INSERT INTO source_health (source_name, status, is_enabled, last_successful_ingest, last_attempt, latest_observation_time, records_fetched, records_accepted, records_rejected)
VALUES 
('synthetic_demo', 'healthy', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 18, 18, 0),
('firms_modis', 'disabled', false, NULL, NULL, NULL, 0, 0, 0),
('firms_viirs', 'disabled', false, NULL, NULL, NULL, 0, 0, 0);
