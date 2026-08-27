from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from app.core.config import FIRMS_ENABLED
from app.engine.firms_client import fetch_firms_data

router = APIRouter()

@router.post("/ingestion/firms")
async def trigger_firms_ingestion(request: Request, background_tasks: BackgroundTasks, source: str = None):
    if not FIRMS_ENABLED:
        raise HTTPException(status_code=403, detail="FIRMS ingestion is disabled.")
    
    pool = request.app.state.pool
    try:
        result = await fetch_firms_data(pool, source=source)
        return {"status": "success", "metrics": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ingestion/status")
async def get_ingestion_status(request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                id, source_name, status, is_enabled, 
                last_successful_ingest, last_failed_ingest, last_attempt, latest_observation_time, 
                records_fetched, records_accepted, records_rejected, 
                error_message, created_at, updated_at
            FROM source_health
            ORDER BY source_name ASC
        """)
    
    sources = []
    for row in rows:
        sources.append({
            "id": row['id'],
            "source_name": row['source_name'],
            "status": row['status'],
            "is_enabled": row['is_enabled'],
            "last_successful_ingest": row['last_successful_ingest'].isoformat() if row['last_successful_ingest'] else None,
            "last_failed_ingest": row['last_failed_ingest'].isoformat() if row['last_failed_ingest'] else None,
            "last_attempt": row['last_attempt'].isoformat() if row['last_attempt'] else None,
            "latest_observation_time": row['latest_observation_time'].isoformat() if row['latest_observation_time'] else None,
            "records_fetched": row['records_fetched'],
            "records_accepted": row['records_accepted'],
            "records_rejected": row['records_rejected'],
            "error_message": row['error_message'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
        })
        
    return {
        "sources": sources
    }
