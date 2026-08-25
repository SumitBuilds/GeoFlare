import pytest
from fastapi.testclient import TestClient
from app.main import app
import os

os.environ["DATABASE_URL"] = "postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare"

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/v1/system/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "healthy"}

def test_get_fires():
    with TestClient(app) as client:
        response = client.get("/api/v1/fires")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 3
    
def test_get_fires_filtered():
    with TestClient(app) as client:
        response = client.get("/api/v1/fires?classification=industrial_fire_flare")
        assert response.status_code == 200
        data = response.json()
        assert len(data["features"]) == 1
        assert data["features"][0]["properties"]["classification"] == "industrial_fire_flare"
        assert data["features"][0]["properties"]["classification_confidence"] == "high"

def test_get_fire_by_id():
    with TestClient(app) as client:
        response = client.get("/api/v1/fires/1")
        assert response.status_code == 200
        data = response.json()
        assert data["properties"]["id"] == 1

def test_get_industrial_zones():
    with TestClient(app) as client:
        response = client.get("/api/v1/industrial-zones")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1

def test_get_alerts():
    with TestClient(app) as client:
        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

def test_update_alert_status():
    with TestClient(app) as client:
        response = client.patch("/api/v1/alerts/1/status", json={"status": "investigating"})
        assert response.status_code == 200
        assert response.json()["status"] == "investigating"
        
        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        updated_alert = next(a for a in data if a["id"] == 1)
        assert updated_alert["status"] == "investigating"
