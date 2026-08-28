CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE industrial_facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(100),
    location GEOGRAPHY(Polygon, 4326) NOT NULL
);

CREATE TABLE hotspots (
    id SERIAL PRIMARY KEY,
    first_observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    confidence VARCHAR(50) NOT NULL,
    satellite VARCHAR(50) NOT NULL,
    temperature FLOAT NOT NULL,
    frp FLOAT NOT NULL,
    days_observed INT DEFAULT 1,
    observation_count INT DEFAULT 1,
    alert_status VARCHAR(50) DEFAULT 'pending',
    source VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'unknown',
    risk_score FLOAT DEFAULT 0.0,
    approx_movement FLOAT DEFAULT 0.0,
    persistence_confidence FLOAT DEFAULT 0.0,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hotspots_location ON hotspots USING GIST (location);
CREATE INDEX idx_hotspots_last_observed ON hotspots (last_observed_at);

CREATE TABLE fire_observations (
    id SERIAL PRIMARY KEY,
    fire_event_id INT REFERENCES hotspots(id),
    source VARCHAR(100) NOT NULL,
    source_event_id VARCHAR(100) NOT NULL,
    satellite VARCHAR(50) NOT NULL,
    instrument VARCHAR(50),
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    brightness_temperature FLOAT,
    temperature FLOAT NOT NULL,
    frp FLOAT NOT NULL,
    confidence VARCHAR(50) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    raw_metadata JSONB,
    data_quality_flags VARCHAR(50),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    fire_event_id INT REFERENCES hotspots(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    analyst_notes TEXT,
    severity VARCHAR(50),
    source VARCHAR(100),
    is_demo BOOLEAN DEFAULT false,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_history_fire_event ON alert_history(fire_event_id);
CREATE INDEX idx_alert_history_changed_at ON alert_history(changed_at);
