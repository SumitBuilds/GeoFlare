import pytest
from fastapi.testclient import TestClient
from app.main import app
from datetime import datetime, timedelta

client = TestClient(app)

def test_imagery_preview_success():
    # Use a date in the past
    past_date = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
    response = client.get(f"/api/v1/imagery/preview?date={past_date}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["source_name"] == "Esri World Imagery"
    assert data["imagery_date"] == "High-Resolution Static Basemap"
    assert "{z}/{y}/{x}" in data["wmts_url"]
    assert data["max_zoom"] == 18
    assert "Esri" in data["attribution"]
    assert data["cloud_cover"] == "N/A (Cloud-free basemap)"
    assert data["processing_timestamp"] == "Historical composite"
    assert data["preview_url"] == ""

def test_imagery_preview_invalid_date_format():
    response = client.get("/api/v1/imagery/preview?date=invalid-date")
    
    assert response.status_code == 400
    assert "Invalid date format" in response.json()["detail"]

def test_imagery_preview_future_date():
    # Use a date in the future
    future_date = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
    response = client.get(f"/api/v1/imagery/preview?date={future_date}")
    
    assert response.status_code == 400
    assert "future dates" in response.json()["detail"]

