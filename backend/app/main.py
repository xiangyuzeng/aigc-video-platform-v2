import logging
import os
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine
from app.errors import AdsPowerError, PublishError, ScrapingError, PipelineError
from app.models import Base
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + upload dir. Shutdown: dispose engine."""
    # Ensure directories exist
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.assets_dir, exist_ok=True)
    os.makedirs(settings.output_dir, exist_ok=True)
    os.makedirs(os.path.dirname(settings.database_url.replace("sqlite+aiosqlite:///", "")), exist_ok=True)

    # Create tables (for development — use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    start_scheduler()

    yield

    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="AIGC Video Publishing Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (videos, images)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


# --- Global exception handlers ---


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return structured JSON."""
    logging.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": "服务器内部错误，请稍后重试",
        },
    )


@app.exception_handler(AdsPowerError)
async def adspower_error_handler(request: Request, exc: AdsPowerError):
    return JSONResponse(status_code=502, content={"error": "AdsPower Error", "detail": str(exc)})


@app.exception_handler(ScrapingError)
async def scraping_error_handler(request: Request, exc: ScrapingError):
    return JSONResponse(status_code=502, content={"error": "Scraping Error", "detail": str(exc)})


@app.exception_handler(PublishError)
async def publish_error_handler(request: Request, exc: PublishError):
    return JSONResponse(status_code=500, content={"error": "Publish Error", "detail": str(exc)})


@app.exception_handler(PipelineError)
async def pipeline_error_handler(request: Request, exc: PipelineError):
    return JSONResponse(status_code=500, content={"error": "Pipeline Error", "detail": str(exc)})


# --- Register routers ---
from app.routers import servers, videos, profiles, tags, drafts, tasks
app.include_router(servers.router, prefix="/api/servers", tags=["servers"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])

from app.routers import scraper
app.include_router(scraper.router, prefix="/api/scraper", tags=["scraper"])

from app.routers import analytics
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

from app.routers import products, content, pipeline
app.include_router(products.router, prefix="/api/products", tags=["products"])
app.include_router(content.router, prefix="/api/content", tags=["content"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])

from app.routers import app_settings
app.include_router(app_settings.router, prefix="/api/app-settings", tags=["app-settings"])


# --- WebSocket endpoint ---
from app.ws.manager import ws_manager


@app.websocket("/ws/publish")
async def ws_publish(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        ws_manager.disconnect(websocket)


@app.websocket("/ws/pipeline")
async def ws_pipeline(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        ws_manager.disconnect(websocket)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


# --- Serve frontend static files in production (when bundled) ---
import pathlib

_static_dir = pathlib.Path(__file__).parent.parent / "static"
if _static_dir.is_dir():
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve frontend SPA — tries static file first, falls back to index.html."""
        file_path = _static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_static_dir / "index.html")
