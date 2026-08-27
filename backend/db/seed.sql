-- Seed Industrial Facilities (Reference Data)
INSERT INTO industrial_facilities (id, name, facility_type, location)
VALUES 
(1, 'Thane-Belapur Petrochemical Plant (Reference)', 'Refinery', ST_GeogFromText('POLYGON((72.99 19.12, 73.01 19.12, 73.01 19.10, 72.99 19.10, 72.99 19.12))')),
(2, 'Navi Mumbai Steel Works (Reference)', 'Steel Plant', ST_GeogFromText('POLYGON((73.10 19.07, 73.12 19.07, 73.12 19.05, 73.10 19.05, 73.10 19.07))')),
(3, 'Mahape Manufacturing Hub (Reference)', 'Manufacturing', ST_GeogFromText('POLYGON((73.015 19.115, 73.025 19.115, 73.025 19.105, 73.015 19.105, 73.015 19.115))'))
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    facility_type = EXCLUDED.facility_type, 
    location = EXCLUDED.location;

-- Reset sequence
SELECT setval('industrial_facilities_id_seq', (SELECT MAX(id) FROM industrial_facilities));

-- Initial Source Health
INSERT INTO source_health (source_name, status, is_enabled, records_fetched, records_accepted, records_rejected)
VALUES 
('firms_modis', 'disabled', false, 0, 0, 0),
('firms_viirs', 'disabled', false, 0, 0, 0)
ON CONFLICT DO NOTHING;
