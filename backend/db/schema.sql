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
    alert_status VARCHAR(50) DEFAULT 'pending',
    source VARCHAR(100) DEFAULT 'synthetic',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fire_observations (
    id SERIAL PRIMARY KEY,
    fire_event_id INT REFERENCES hotspots(id),
    source VARCHAR(100) NOT NULL,
    source_event_id VARCHAR(100),
    instrument VARCHAR(50),
    acq_time TIMESTAMP WITH TIME ZONE NOT NULL,
    brightness_temperature FLOAT,
    temperature FLOAT,
    frp FLOAT,
    confidence VARCHAR(50),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    raw_metadata JSONB,
    data_quality VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE source_health (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    last_successful_ingest TIMESTAMP WITH TIME ZONE,
    last_attempt TIMESTAMP WITH TIME ZONE,
    latest_observation_time TIMESTAMP WITH TIME ZONE,
    records_fetched INT DEFAULT 0,
    records_accepted INT DEFAULT 0,
    records_rejected INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
