import os
from pathlib import Path

from pydantic_settings import BaseSettings
from typing import List

# Load .env explicitly so it wins over empty shell env vars
from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path, override=True)


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/app.db"

    # File storage
    upload_dir: str = "./data/uploads"
    assets_dir: str = "./data/assets"
    output_dir: str = "./output/videos"

    # AdsPower
    adspower_base_url: str = "http://127.0.0.1:50325"

    # Scraper
    scraper_profile_id: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # AI Services
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    kie_api_key: str = ""
    elevenlabs_api_key: str = ""

    # kie.ai config
    kie_api_url: str = "https://api.kie.ai/api/v1"
    kie_provider: str = "veo"
    kie_default_aspect_ratio: str = "9:16"
    kie_poll_interval: float = 10.0
    kie_poll_timeout: float = 300.0

    # Content generation
    content_primary_language: str = "en"
    content_translation_languages: List[str] = ["zh", "es"]
    content_max_hashtags: int = 8

    # Video
    video_resolution_w: int = 1080
    video_resolution_h: int = 1920
    video_fps: int = 30
    tts_engine: str = "edge-tts"
    tts_voice: str = "en-US-AriaNeural"

    # Pipeline
    pipeline_max_retries: int = 3
    pipeline_retry_base_delay: float = 1.0

    # Defaults
    default_timezone: str = "America/Mexico_City"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
