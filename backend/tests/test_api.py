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
        if len(data["features"]) > 0:
            first_feature = data["features"][0]["properties"]
            assert "is_demo" not in first_feature
            
def test_get_fires_filtered():
    with TestClient(app) as client:
        response = client.get("/api/v1/fires?classification=industrial_fire_flare")
        assert response.status_code == 200
        data = response.json()
        if len(data["features"]) > 0:
            assert data["features"][0]["properties"]["classification"] == "industrial_fire_flare"
            assert data["features"][0]["properties"]["classification_confidence"] == "high"

def test_get_fire_by_id():
    with TestClient(app) as client:
        response = client.get("/api/v1/fires/1")
        if response.status_code == 200:
            data = response.json()
            assert data["properties"]["id"] == 1

def test_get_industrial_zones():
    with TestClient(app) as client:
        response = client.get("/api/v1/industrial-zones")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 3

def test_get_alerts():
    with TestClient(app) as client:
        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

def test_get_ingestion_status():
    with TestClient(app) as client:
        response = client.get("/api/v1/ingestion/status")
        assert response.status_code == 200
        data = response.json()
        assert "sources" in data
        assert len(data["sources"]) >= 2
        
        # Verify synthetic demo source is NOT present, only FIRMS
        source_names = [s["source_name"] for s in data["sources"]]
        assert "firms_modis" in source_names
        assert "firms_viirs" in source_names
        assert "synthetic_demo" not in source_names
