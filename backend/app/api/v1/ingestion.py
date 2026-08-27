from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/ingestion/status")
async def get_ingestion_status(request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                id, source_name, status, is_enabled, 
                last_successful_ingest, last_failed_ingest, last_attempt, latest_observation_time, 
                records_fetched, records_accepted, records_rejected, 
                error_message, is_demo_fallback, created_at, updated_at
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
            "is_demo_fallback": row['is_demo_fallback'],
            "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
        })
        
    return {
        "sources": sources
    }
