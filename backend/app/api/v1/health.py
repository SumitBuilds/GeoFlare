from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/system/health")
async def health_check(request: Request):
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "healthy"}
    except Exception:
        return {"status": "ok", "database": "unhealthy"}
