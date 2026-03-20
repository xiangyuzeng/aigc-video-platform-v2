import os
import json
import asyncio
from uuid import uuid4
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.config import settings
from app.models import Video
from app.schemas import VideoResponse, VideoListResponse

router = APIRouter()

CHUNK_SIZE = 1024 * 1024  # 1 MB

MIME_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
}


async def _probe_video(filepath: str) -> tuple[float | None, str | None]:
    """Run ffprobe to extract duration and resolution. Returns (duration, resolution)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", filepath,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            return None, None

        info = json.loads(stdout.decode())

        # Duration from format
        duration: float | None = None
        fmt = info.get("format", {})
        if "duration" in fmt:
            try:
                duration = float(fmt["duration"])
            except (ValueError, TypeError):
                pass

        # Resolution from first video stream
        resolution: str | None = None
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                w = stream.get("width")
                h = stream.get("height")
                if w and h:
                    resolution = f"{w}x{h}"
                break

        return duration, resolution
    except (FileNotFoundError, OSError):
        # ffprobe not installed
        return None, None


async def _generate_thumbnail(filepath: str, cover_path: str) -> str | None:
    """Run ffmpeg to extract a thumbnail frame. Returns cover_path on success, None on failure."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-i", filepath,
            "-ss", "00:00:01", "-vframes", "1", "-y", cover_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        if proc.returncode == 0 and os.path.exists(cover_path):
            return cover_path
        return None
    except (FileNotFoundError, OSError):
        # ffmpeg not installed
        return None


# --------------------------------------------------------------------------- #
#  POST /upload — multipart upload (multiple files)
# --------------------------------------------------------------------------- #

@router.post("/upload", response_model=list[VideoResponse])
async def upload_videos(
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
):
    os.makedirs(settings.upload_dir, exist_ok=True)
    results: list[Video] = []

    for file in files:
        # Generate unique filename
        ext = Path(file.filename).suffix if file.filename else ".mp4"
        unique_name = f"{uuid4()}{ext}"
        filepath = os.path.abspath(os.path.join(settings.upload_dir, unique_name))

        # Save file to disk
        async with aiofiles.open(filepath, "wb") as out:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                await out.write(chunk)

        # Probe for duration / resolution
        duration, resolution = await _probe_video(filepath)

        # Generate thumbnail
        cover_name = f"{uuid4()}_cover.jpg"
        cover_dest = os.path.abspath(os.path.join(settings.upload_dir, cover_name))
        cover_path = await _generate_thumbnail(filepath, cover_dest)

        # File size
        file_size = os.path.getsize(filepath)

        # Title = original filename without extension
        title = Path(file.filename).stem if file.filename else unique_name

        video = Video(
            title=title,
            file_path=filepath,
            cover_path=cover_path,
            duration_seconds=duration,
            file_size_bytes=file_size,
            resolution=resolution,
            status="ready",
        )
        db.add(video)
        results.append(video)

    await db.commit()
    for v in results:
        await db.refresh(v)

    return results


# --------------------------------------------------------------------------- #
#  GET / — list with filters
# --------------------------------------------------------------------------- #

@router.get("/", response_model=VideoListResponse)
async def list_videos(
    group_name: str | None = None,
    status: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(Video)
    count_query = select(func.count(Video.id))

    if group_name is not None:
        query = query.where(Video.group_name == group_name)
        count_query = count_query.where(Video.group_name == group_name)
    if status is not None:
        query = query.where(Video.status == status)
        count_query = count_query.where(Video.status == status)
    if search is not None:
        pattern = f"%{search}%"
        query = query.where(Video.title.ilike(pattern))
        count_query = count_query.where(Video.title.ilike(pattern))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Video.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(query)).scalars().all()

    return VideoListResponse(items=rows, total=total)


# --------------------------------------------------------------------------- #
#  GET /{video_id} — single video
# --------------------------------------------------------------------------- #

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: int, db: AsyncSession = Depends(get_db)):
    video = (await db.execute(select(Video).where(Video.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


# --------------------------------------------------------------------------- #
#  DELETE /{video_id} — delete video + files
# --------------------------------------------------------------------------- #

@router.delete("/{video_id}")
async def delete_video(video_id: int, db: AsyncSession = Depends(get_db)):
    video = (await db.execute(select(Video).where(Video.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Remove physical files (ignore errors if already missing)
    for path in (video.file_path, video.cover_path):
        if path:
            try:
                os.remove(path)
            except OSError:
                pass

    await db.delete(video)
    await db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
#  GET /{video_id}/stream — video streaming with Range headers
# --------------------------------------------------------------------------- #

@router.get("/{video_id}/stream")
async def stream_video(video_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    video = (await db.execute(select(Video).where(Video.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not os.path.exists(video.file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = os.path.getsize(video.file_path)
    ext = Path(video.file_path).suffix.lower()
    content_type = MIME_TYPES.get(ext, "video/mp4")

    range_header = request.headers.get("range")

    if range_header is None:
        # No Range — return full file
        return FileResponse(video.file_path, media_type=content_type)

    # Parse Range header: "bytes=START-" or "bytes=START-END"
    try:
        range_spec = range_header.replace("bytes=", "").strip()
        parts = range_spec.split("-")
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else file_size - 1
    except (ValueError, IndexError):
        raise HTTPException(status_code=416, detail="Invalid Range header")

    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable",
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    content_length = end - start + 1

    async def _stream_generator():
        async with aiofiles.open(video.file_path, "rb") as f:
            await f.seek(start)
            remaining = content_length
            while remaining > 0:
                read_size = min(CHUNK_SIZE, remaining)
                data = await f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": content_type,
    }

    return StreamingResponse(
        _stream_generator(),
        status_code=206,
        headers=headers,
        media_type=content_type,
    )


# --------------------------------------------------------------------------- #
#  GET /{video_id}/thumbnail — serve cover image
# --------------------------------------------------------------------------- #

@router.get("/{video_id}/thumbnail")
async def get_thumbnail(video_id: int, db: AsyncSession = Depends(get_db)):
    video = (await db.execute(select(Video).where(Video.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.cover_path or not os.path.exists(video.cover_path):
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(video.cover_path, media_type="image/jpeg")


# --------------------------------------------------------------------------- #
#  POST /{video_id}/transcribe — run faster-whisper transcription
# --------------------------------------------------------------------------- #

@router.post("/{video_id}/transcribe")
async def transcribe_video_endpoint(video_id: int, db: AsyncSession = Depends(get_db)):
    video = (await db.execute(select(Video).where(Video.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not os.path.exists(video.file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    from app.database import AsyncSessionLocal

    async def _transcribe_bg(vid_id: int, vid_path: str):
        try:
            from app.services.transcriber import transcribe_video
            transcript = await transcribe_video(vid_path)
            async with AsyncSessionLocal() as session:
                v = await session.get(Video, vid_id)
                if v:
                    v.transcript = transcript
                    await session.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Transcription failed for video {vid_id}: {e}")

    asyncio.create_task(_transcribe_bg(video.id, video.file_path))
    return {"status": "queued", "video_id": video.id}
