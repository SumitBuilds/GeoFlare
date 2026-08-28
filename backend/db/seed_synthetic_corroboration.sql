-- ============================================================
-- SYNTHETIC CORROBORATION RECORDS — DEMO ONLY
-- These are NOT real satellite observations.
-- They are inserted to demonstrate the Phase 7 multi-source
-- corroboration display with Partial and Strong levels.
-- Source label includes [SYNTHETIC CORROBORATION — DEMO ONLY]
-- No new hotspots are created. All fire_event_id values
-- reference existing real FIRMS VIIRS hotspots.
-- ============================================================

-- ── Hotspot 3 (lat 21.10, lon 72.64) → PARTIAL corroboration
-- Adds a synthetic MODIS observation: VIIRS + MODIS = 2 sources = Partial

INSERT INTO fire_observations
    (fire_event_id, source, source_event_id, satellite, instrument, observed_at,
     brightness_temperature, temperature, frp, confidence, location, raw_metadata, data_quality_flags)
VALUES
    (3,
     '[SYNTHETIC CORROBORATION — DEMO ONLY] NASA_FIRMS_MODIS',
     'SYNTH_MODIS_21.1025_72.64508_2026-08-26_0900',
     'Terra',
     'MODIS',
     '2026-08-26 09:00:00+00',
     330.2, 330.2, 5.8, 'nominal',
     ST_SetSRID(ST_MakePoint(72.64508, 21.1025), 4326),
     '{"note": "SYNTHETIC CORROBORATION DEMO ONLY — NOT a real MODIS observation", "instrument": "MODIS", "satellite": "Terra"}',
     'SYNTHETIC_DEMO')
ON CONFLICT (source, source_event_id) DO NOTHING;


-- ── Hotspot 1 (lat 19.0, lon 73.0) → STRONG corroboration
-- Adds synthetic MODIS + INSAT-3D observations: VIIRS + MODIS + INSAT = 3 sources = Strong

INSERT INTO fire_observations
    (fire_event_id, source, source_event_id, satellite, instrument, observed_at,
     brightness_temperature, temperature, frp, confidence, location, raw_metadata, data_quality_flags)
VALUES
    (1,
     '[SYNTHETIC CORROBORATION — DEMO ONLY] NASA_FIRMS_MODIS',
     'SYNTH_MODIS_19.0_73.0_2026-08-27_1000',
     'Aqua',
     'MODIS',
     '2026-08-27 10:00:00+00',
     315.7, 315.7, 12.1, 'nominal',
     ST_SetSRID(ST_MakePoint(73.0, 19.0), 4326),
     '{"note": "SYNTHETIC CORROBORATION DEMO ONLY — NOT a real MODIS observation", "instrument": "MODIS", "satellite": "Aqua"}',
     'SYNTHETIC_DEMO')
ON CONFLICT (source, source_event_id) DO NOTHING;

INSERT INTO fire_observations
    (fire_event_id, source, source_event_id, satellite, instrument, observed_at,
     brightness_temperature, temperature, frp, confidence, location, raw_metadata, data_quality_flags)
VALUES
    (1,
     '[SYNTHETIC CORROBORATION — DEMO ONLY] INSAT-3D',
     'SYNTH_INSAT_19.0_73.0_2026-08-27_1030',
     'INSAT-3D',
     'INSAT',
     '2026-08-27 10:30:00+00',
     312.5, 312.5, 10.0, 'nominal',
     ST_SetSRID(ST_MakePoint(73.0, 19.0), 4326),
     '{"note": "SYNTHETIC CORROBORATION DEMO ONLY — NOT a real INSAT-3D observation", "instrument": "INSAT", "satellite": "INSAT-3D"}',
     'SYNTHETIC_DEMO')
ON CONFLICT (source, source_event_id) DO NOTHING;


-- ── Hotspot 27 (lat 21.10, lon 72.63) → STRONG corroboration
-- Adds synthetic MODIS + Sentinel-3 observations: VIIRS + MODIS + SENTINEL = 3 sources = Strong

INSERT INTO fire_observations
    (fire_event_id, source, source_event_id, satellite, instrument, observed_at,
     brightness_temperature, temperature, frp, confidence, location, raw_metadata, data_quality_flags)
VALUES
    (27,
     '[SYNTHETIC CORROBORATION — DEMO ONLY] NASA_FIRMS_MODIS',
     'SYNTH_MODIS_21.10283_72.63239_2026-08-26_0900',
     'Terra',
     'MODIS',
     '2026-08-26 09:00:00+00',
     328.1, 328.1, 7.4, 'nominal',
     ST_SetSRID(ST_MakePoint(72.63239, 21.10283), 4326),
     '{"note": "SYNTHETIC CORROBORATION DEMO ONLY — NOT a real MODIS observation", "instrument": "MODIS", "satellite": "Terra"}',
     'SYNTHETIC_DEMO')
ON CONFLICT (source, source_event_id) DO NOTHING;

INSERT INTO fire_observations
    (fire_event_id, source, source_event_id, satellite, instrument, observed_at,
     brightness_temperature, temperature, frp, confidence, location, raw_metadata, data_quality_flags)
VALUES
    (27,
     '[SYNTHETIC CORROBORATION — DEMO ONLY] Sentinel-3 SLSTR',
     'SYNTH_SENTINEL_21.10283_72.63239_2026-08-26_0930',
     'Sentinel-3A',
     'SENTINEL',
     '2026-08-26 09:30:00+00',
     322.0, 322.0, 6.5, 'nominal',
     ST_SetSRID(ST_MakePoint(72.63239, 21.10283), 4326),
     '{"note": "SYNTHETIC CORROBORATION DEMO ONLY — NOT a real Sentinel-3 observation", "instrument": "SENTINEL", "satellite": "Sentinel-3A"}',
     'SYNTHETIC_DEMO')
ON CONFLICT (source, source_event_id) DO NOTHING;
