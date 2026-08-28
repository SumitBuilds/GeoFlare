from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

class ImageryPreviewResponse(BaseModel):
    source_name: str
    imagery_date: str
    wmts_url: str
    preview_url: str
    max_zoom: int
    attribution: str
    cloud_cover: str
    processing_timestamp: str

@router.get("/imagery/preview", response_model=ImageryPreviewResponse)
async def get_imagery_preview(date: str = Query(..., description="Date of the detection (YYYY-MM-DD)"), lat: float = Query(None), lng: float = Query(None)):
    """
    Returns Esri World Imagery metadata and tile URL.
    This serves as a high-resolution, tokenless basemap fallback.
    """
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
    
    if parsed_date > datetime.utcnow().date():
        raise HTTPException(status_code=400, detail="Cannot request imagery for future dates.")

    # Esri World Imagery endpoint
    wmts_url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    
    return ImageryPreviewResponse(
        source_name="Esri World Imagery",
        imagery_date="High-Resolution Static Basemap",
        wmts_url=wmts_url,
        preview_url="",
        max_zoom=18,
        attribution="Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        cloud_cover="N/A (Cloud-free basemap)",
        processing_timestamp="Historical composite"
    )
