from fastapi import APIRouter
from .fires import router as fires_router
from .industrial_zones import router as zones_router
from .alerts import router as alerts_router
from .health import router as health_router
from .ingestion import router as ingestion_router

router = APIRouter()
router.include_router(fires_router, tags=["Fires"])
router.include_router(zones_router, tags=["Industrial Zones"])
router.include_router(alerts_router, tags=["Alerts"])
router.include_router(health_router, tags=["Health"])
router.include_router(ingestion_router, tags=["Ingestion"])
