from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter()

class AlertStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    severity: Optional[str] = None
    source: Optional[str] = None
    is_demo: Optional[bool] = False

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
        # Fetch old status first
        row = await conn.fetchrow("SELECT alert_status FROM hotspots WHERE id = $1", alert_id)
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        old_status = row['alert_status']
        
        async with conn.transaction():
            # Update hotspot
            await conn.execute(
                "UPDATE hotspots SET alert_status = $1 WHERE id = $2",
                update.status, alert_id
            )
            
            # Insert history
            await conn.execute(
                """
                INSERT INTO alert_history 
                (fire_event_id, old_status, new_status, reason, analyst_notes, severity, source, is_demo)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                alert_id, old_status, update.status, update.reason, update.notes, 
                update.severity, update.source, update.is_demo
            )
            
    return {"id": alert_id, "status": update.status}

@router.get("/alerts/{alert_id}/history")
async def get_alert_history(alert_id: int, request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, old_status, new_status, reason, analyst_notes, severity, source, is_demo, changed_at
            FROM alert_history
            WHERE fire_event_id = $1
            ORDER BY changed_at DESC
        """, alert_id)
        
    history = []
    for row in rows:
        history.append({
            "id": row['id'],
            "old_status": row['old_status'],
            "new_status": row['new_status'],
            "reason": row['reason'],
            "analyst_notes": row['analyst_notes'],
            "severity": row['severity'],
            "source": row['source'],
            "is_demo": row['is_demo'],
            "changed_at": row['changed_at'].isoformat() if row['changed_at'] else None
        })
    return history
