from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import json

router = APIRouter()

class AlertStatusUpdate(BaseModel):
    status: str

@router.get("/alerts")
async def get_alerts(request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, last_observed_at as observed_at, confidence, satellite, alert_status, ST_AsGeoJSON(location)::json as geometry
            FROM hotspots
            ORDER BY last_observed_at DESC
        """)
        
    alerts = []
    for row in rows:
        alerts.append({
            "id": row['id'],
            "observed_at": row['observed_at'].isoformat() if row['observed_at'] else None,
            "confidence": row['confidence'],
            "satellite": row['satellite'],
            "status": row['alert_status'],
            "geometry": json.loads(row['geometry']) if isinstance(row['geometry'], str) else row['geometry']
        })
    return alerts

@router.patch("/alerts/{alert_id}/status")
async def update_alert_status(alert_id: int, update: AlertStatusUpdate, request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE hotspots SET alert_status = $1 WHERE id = $2",
            update.status, alert_id
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Alert not found")
            
    return {"id": alert_id, "status": update.status}
