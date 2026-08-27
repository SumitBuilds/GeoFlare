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
    first_observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    confidence VARCHAR(50),
    satellite VARCHAR(50) DEFAULT 'MODIS_DEMO',
    temperature FLOAT DEFAULT 300.0,
    frp FLOAT DEFAULT 5.0,
    days_observed INT DEFAULT 1,
    observation_count INT DEFAULT 1,
    alert_status VARCHAR(50) DEFAULT 'pending',
    source VARCHAR(100) DEFAULT 'synthetic',
    severity VARCHAR(50) DEFAULT 'unknown',
    risk_score FLOAT DEFAULT 0.0,
    is_demo BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hotspots_location ON hotspots USING GIST (location);
CREATE INDEX idx_hotspots_last_observed ON hotspots (last_observed_at);

CREATE TABLE fire_observations (
    id SERIAL PRIMARY KEY,
    fire_event_id INT REFERENCES hotspots(id),
    source VARCHAR(100) NOT NULL,
    source_event_id VARCHAR(100),
    satellite VARCHAR(50),
    instrument VARCHAR(50),
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    brightness_temperature FLOAT,
    temperature FLOAT,
    frp FLOAT,
    confidence VARCHAR(50),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    raw_metadata JSONB,
    data_quality_flags VARCHAR(50),
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_event_id)
);

CREATE INDEX idx_fire_obs_location ON fire_observations USING GIST (location);
CREATE INDEX idx_fire_obs_observed_at ON fire_observations (observed_at);

CREATE TABLE source_health (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    last_successful_ingest TIMESTAMP WITH TIME ZONE,
    last_failed_ingest TIMESTAMP WITH TIME ZONE,
    last_attempt TIMESTAMP WITH TIME ZONE,
    latest_observation_time TIMESTAMP WITH TIME ZONE,
    records_fetched INT DEFAULT 0,
    records_accepted INT DEFAULT 0,
    records_rejected INT DEFAULT 0,
    error_message TEXT,
    is_demo_fallback BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
