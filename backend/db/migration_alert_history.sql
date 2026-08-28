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
