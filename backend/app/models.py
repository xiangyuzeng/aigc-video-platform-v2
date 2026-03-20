from datetime import datetime

from sqlalchemy import String, Integer, Float, Text, Boolean, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Server(Base):
    """AdsPower server connection"""
    __tablename__ = "servers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    base_url: Mapped[str] = mapped_column(String(255))  # e.g. http://127.0.0.1:50325
    is_default: Mapped[bool] = mapped_column(default=False)
    last_connected_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    profiles: Mapped[list["Profile"]] = relationship(back_populates="server", cascade="all, delete-orphan")


class Profile(Base):
    """AdsPower browser profile (represents one social media account)"""
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id"))
    profile_id: Mapped[str] = mapped_column(String(100))  # AdsPower user_id
    profile_name: Mapped[str] = mapped_column(String(255))
    group_id: Mapped[str | None] = mapped_column(String(100))
    group_name: Mapped[str | None] = mapped_column(String(100))
    platform: Mapped[str] = mapped_column(String(50), default="tiktok")
    label: Mapped[str | None] = mapped_column(String(255))  # user-defined label
    remark: Mapped[str | None] = mapped_column(Text)
    serial_number: Mapped[str | None] = mapped_column(String(100))
    last_synced_at: Mapped[datetime | None] = mapped_column(default=None)
    server: Mapped["Server"] = relationship(back_populates="profiles")
    tasks: Mapped[list["Task"]] = relationship(back_populates="profile")


class Video(Base):
    """Local video asset"""
    __tablename__ = "videos"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str | None] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1000))  # absolute path on disk
    cover_path: Mapped[str | None] = mapped_column(String(1000))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    resolution: Mapped[str | None] = mapped_column(String(20))  # e.g. "1080x1920"
    transcript: Mapped[str | None] = mapped_column(Text)
    group_name: Mapped[str | None] = mapped_column(String(100))
    custom_pid: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), default="ready")
    metadata_json: Mapped[str | None] = mapped_column(Text)  # JSON string for flexible extra data
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Task(Base):
    """A single publish task: one video → one profile"""
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    task_name: Mapped[str] = mapped_column(String(255))  # batch name, e.g. "Task_20260316_143000"
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"))
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"))

    # Content fields
    content: Mapped[str | None] = mapped_column(Text)           # post caption
    tags: Mapped[str | None] = mapped_column(Text)              # hashtags, space-separated
    trans_content: Mapped[str | None] = mapped_column(Text)     # translated caption
    trans_tags: Mapped[str | None] = mapped_column(Text)        # translated hashtags
    cover_override_path: Mapped[str | None] = mapped_column(String(1000))  # custom cover

    # Scheduling
    scheduled_at: Mapped[datetime | None] = mapped_column(default=None)
    timezone: Mapped[str] = mapped_column(String(100), default="America/Mexico_City")

    # Execution state
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # Statuses: draft → queued → uploading → publishing → published | failed | cancelled
    retry_count: Mapped[int] = mapped_column(default=0)
    max_retries: Mapped[int] = mapped_column(default=3)
    error_message: Mapped[str | None] = mapped_column(Text)
    published_url: Mapped[str | None] = mapped_column(String(1000))

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    published_at: Mapped[datetime | None] = mapped_column(default=None)

    profile: Mapped["Profile"] = relationship(back_populates="tasks")
    video: Mapped["Video"] = relationship()


class Draft(Base):
    """Saved wizard state snapshot"""
    __tablename__ = "drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    data_json: Mapped[str] = mapped_column(Text)  # Full wizard state as JSON
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class TagHistory(Base):
    """Recently used tags for autocomplete"""
    __tablename__ = "tag_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    tag: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(50), default="tiktok")
    use_count: Mapped[int] = mapped_column(default=1)
    last_used_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ScrapedContent(Base):
    """Cached results from FastMoss scraping"""
    __tablename__ = "scraped_content"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_url: Mapped[str] = mapped_column(String(1000))
    original_content: Mapped[str | None] = mapped_column(Text)
    original_tags: Mapped[str | None] = mapped_column(Text)
    translated_content: Mapped[str | None] = mapped_column(Text)
    translated_tags: Mapped[str | None] = mapped_column(Text)
    scraped_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


# ── New tables for upstream pipeline ─────────────────────────────


class Product(Base):
    """Scraped or manually entered product"""
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(200))
    price: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    source_url: Mapped[str | None] = mapped_column(String(2000))
    image_urls_json: Mapped[str | None] = mapped_column(Text)   # JSON array
    description: Mapped[str | None] = mapped_column(Text)
    score: Mapped[float | None] = mapped_column(Float)           # 0-100 viral potential
    score_reasoning: Mapped[str | None] = mapped_column(Text)
    suggested_angles_json: Mapped[str | None] = mapped_column(Text)  # JSON array
    raw_data_json: Mapped[str | None] = mapped_column(Text)     # flexible extra data
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    content_pieces: Mapped[list["ContentPiece"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ContentPiece(Base):
    """AI-generated content for a product"""
    __tablename__ = "content_pieces"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    caption: Mapped[str | None] = mapped_column(Text)
    tags_json: Mapped[str | None] = mapped_column(Text)         # JSON array of hashtags
    description: Mapped[str | None] = mapped_column(Text)
    script_json: Mapped[str | None] = mapped_column(Text)       # JSON {hook, body, cta}
    style: Mapped[str] = mapped_column(String(50), default="product_review")
    language: Mapped[str] = mapped_column(String(10), default="en")
    translations_json: Mapped[str | None] = mapped_column(Text) # JSON {lang: {caption, tags, desc}}
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="content_pieces")


class PipelineRun(Base):
    """End-to-end pipeline execution"""
    __tablename__ = "pipeline_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    video_id: Mapped[int | None] = mapped_column(ForeignKey("videos.id", ondelete="SET NULL"))
    content_piece_id: Mapped[int | None] = mapped_column(ForeignKey("content_pieces.id", ondelete="SET NULL"))

    # Configuration
    style: Mapped[str] = mapped_column(String(50), default="product_review")
    video_source: Mapped[str] = mapped_column(String(20), default="kie")  # kie / moviepy / upload
    uploaded_video_path: Mapped[str | None] = mapped_column(String(1000))
    target_profile_ids_json: Mapped[str | None] = mapped_column(Text)     # JSON array
    schedule_time: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(100), default="America/Mexico_City")

    # State
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # Statuses: draft -> running -> completed | failed | cancelled
    current_stage: Mapped[str] = mapped_column(String(50), default="init")
    stages_json: Mapped[str | None] = mapped_column(Text)  # JSON array of stage results
    error_message: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(default=None)

    product: Mapped["Product | None"] = relationship(back_populates="pipeline_runs")
    video: Mapped["Video | None"] = relationship()
    content_piece: Mapped["ContentPiece | None"] = relationship()


class Template(Base):
    """Reusable caption/tag template with variable placeholders"""
    __tablename__ = "templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    content_template: Mapped[str | None] = mapped_column(Text)  # e.g. "Check out {product_name}! Only {price}!"
    tags_template: Mapped[str | None] = mapped_column(Text)     # e.g. "#好物推荐 #{category}"
    variables_json: Mapped[str | None] = mapped_column(Text)    # JSON array of variable names
    category: Mapped[str | None] = mapped_column(String(100))   # e.g. 好物推荐, 开箱测评
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class AppSetting(Base):
    """Key-value store for app-level settings"""
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
