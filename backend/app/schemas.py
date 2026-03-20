from pydantic import BaseModel, ConfigDict
from datetime import datetime


# --- Server schemas ---

class ServerCreate(BaseModel):
    name: str
    base_url: str


class ServerUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    is_default: bool | None = None


class ServerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_url: str
    is_default: bool
    last_connected_at: datetime | None
    created_at: datetime


# --- Video schemas ---

class VideoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str | None
    file_path: str
    cover_path: str | None
    duration_seconds: float | None
    file_size_bytes: int | None
    resolution: str | None
    transcript: str | None
    group_name: str | None
    custom_pid: str | None
    status: str
    metadata_json: str | None
    created_at: datetime


class VideoListResponse(BaseModel):
    items: list[VideoResponse]
    total: int


# --- Profile schemas ---

class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    profile_id: str
    profile_name: str
    group_id: str | None
    group_name: str | None
    platform: str
    label: str | None
    remark: str | None
    serial_number: str | None
    last_synced_at: datetime | None


class ProfileUpdate(BaseModel):
    label: str | None = None
    platform: str | None = None
    remark: str | None = None


# --- Draft schemas ---

class DraftCreate(BaseModel):
    name: str
    data_json: str


class DraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    data_json: str
    created_at: datetime


# --- Task schemas ---

class TaskCreate(BaseModel):
    task_name: str
    profile_id: int
    video_id: int
    content: str | None = None
    tags: str | None = None
    trans_content: str | None = None
    trans_tags: str | None = None
    cover_override_path: str | None = None
    scheduled_at: datetime | None = None
    timezone: str = "America/Mexico_City"


class TaskUpdate(BaseModel):
    content: str | None = None
    tags: str | None = None
    trans_content: str | None = None
    trans_tags: str | None = None
    cover_override_path: str | None = None
    scheduled_at: datetime | None = None
    timezone: str | None = None
    status: str | None = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_name: str
    profile_id: int
    video_id: int
    content: str | None
    tags: str | None
    trans_content: str | None
    trans_tags: str | None
    cover_override_path: str | None
    scheduled_at: datetime | None
    timezone: str
    status: str
    retry_count: int
    max_retries: int
    error_message: str | None
    published_url: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


# --- Product schemas ---

class ProductCreate(BaseModel):
    name: str
    category: str | None = None
    price: float | None = None
    currency: str = "USD"
    source_url: str | None = None
    image_urls_json: str | None = None
    description: str | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None
    price: float | None
    currency: str
    source_url: str | None
    image_urls_json: str | None
    description: str | None
    score: float | None
    score_reasoning: str | None
    suggested_angles_json: str | None
    raw_data_json: str | None
    created_at: datetime


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int


class ScrapeRequest(BaseModel):
    url: str


# --- Content schemas ---

class ContentGenerateRequest(BaseModel):
    product_id: int
    style: str = "product_review"


class ScriptGenerateRequest(BaseModel):
    product_id: int
    style: str = "product_review"
    duration: int = 30


class ContentPieceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    caption: str | None
    tags_json: str | None
    description: str | None
    script_json: str | None
    style: str
    language: str
    translations_json: str | None
    created_at: datetime


class TranslateRequest(BaseModel):
    languages: list[str] = ["zh", "es"]


# --- Pipeline schemas ---

class PipelineRunCreate(BaseModel):
    product_id: int
    style: str = "product_review"
    video_source: str = "kie"  # kie / moviepy / upload
    uploaded_video_path: str | None = None
    target_profile_ids: list[int] = []
    schedule_time: str | None = None
    timezone: str = "America/Mexico_City"


class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int | None
    video_id: int | None
    content_piece_id: int | None
    style: str
    video_source: str
    uploaded_video_path: str | None
    target_profile_ids_json: str | None
    schedule_time: str | None
    timezone: str
    status: str
    current_stage: str
    stages_json: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class PipelineRunListResponse(BaseModel):
    items: list[PipelineRunResponse]
    total: int
