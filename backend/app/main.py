from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
import os
from .api.v1 import router as api_router

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.pool = await asyncpg.create_pool(DATABASE_URL)
    yield
    # Shutdown
    await app.state.pool.close()

app = FastAPI(title="GeoFlare AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
