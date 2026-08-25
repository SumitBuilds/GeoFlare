CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE industrial_facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(100),
    is_demo_data BOOLEAN DEFAULT true,
    location GEOGRAPHY(Polygon, 4326) NOT NULL
);

CREATE TABLE hotspots (
    id SERIAL PRIMARY KEY,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    confidence VARCHAR(50),
    satellite VARCHAR(50) DEFAULT 'MODIS_DEMO',
    temperature FLOAT DEFAULT 300.0,
    frp FLOAT DEFAULT 5.0,
    days_observed INT DEFAULT 1,
    observation_count INT DEFAULT 1,
    alert_status VARCHAR(50) DEFAULT 'pending'
);
