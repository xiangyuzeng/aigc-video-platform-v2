from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date
from app.database import get_db
from app.models import Profile, Video, Task, ScrapedContent

router = APIRouter()


@router.get("/")
async def get_overview(db: AsyncSession = Depends(get_db)):
    """Return overview stats: total profiles, videos, tasks today, and 7-day success rate."""
    # total_profiles
    profile_count_result = await db.execute(select(func.count()).select_from(Profile))
    total_profiles = profile_count_result.scalar() or 0

    # total_videos
    video_count_result = await db.execute(select(func.count()).select_from(Video))
    total_videos = video_count_result.scalar() or 0

    # total_scraped
    scraped_count_result = await db.execute(select(func.count()).select_from(ScrapedContent))
    total_scraped = scraped_count_result.scalar() or 0

    # tasks_today
    today = date.today()
    tasks_today_result = await db.execute(
        select(func.count())
        .select_from(Task)
        .where(cast(Task.created_at, Date) == today)
    )
    tasks_today = tasks_today_result.scalar() or 0

    # total_tasks (all tasks ever created)
    total_tasks_result = await db.execute(select(func.count()).select_from(Task))
    total_tasks = total_tasks_result.scalar() or 0

    # total_published (tasks with status='published')
    published_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.status == "published")
    )
    total_published = published_result.scalar() or 0

    # total_queued
    queued_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.status == "queued")
    )
    total_queued = queued_result.scalar() or 0

    # total_in_progress
    in_progress_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.status.in_(["uploading", "publishing"]))
    )
    total_in_progress = in_progress_result.scalar() or 0

    # success_rate over last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    rate_result = await db.execute(
        select(
            func.sum(case((Task.status == "published", 1), else_=0)).label("published"),
            func.sum(case((Task.status == "failed", 1), else_=0)).label("failed"),
        )
        .where(Task.created_at >= seven_days_ago)
        .where(Task.status.in_(["published", "failed"]))
    )
    row = rate_result.one()
    published_count = row.published or 0
    failed_count = row.failed or 0
    total_terminal = published_count + failed_count
    success_rate = round((published_count / total_terminal) * 100, 2) if total_terminal > 0 else 0.0

    return {
        "total_profiles": total_profiles,
        "total_videos": total_videos,
        "total_scraped": total_scraped,
        "total_tasks": total_tasks,
        "total_published": total_published,
        "total_queued": total_queued,
        "total_in_progress": total_in_progress,
        "tasks_today": tasks_today,
        "success_rate": success_rate,
    }


@router.get("/timeline")
async def get_timeline(
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return per-day published/failed counts for charting."""
    if date_to:
        end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
    else:
        end_date = date.today()

    if date_from:
        start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
    else:
        start_date = end_date - timedelta(days=6)

    result = await db.execute(
        select(
            cast(Task.created_at, Date).label("day"),
            func.sum(case((Task.status == "published", 1), else_=0)).label("published"),
            func.sum(case((Task.status == "failed", 1), else_=0)).label("failed"),
        )
        .where(cast(Task.created_at, Date) >= start_date)
        .where(cast(Task.created_at, Date) <= end_date)
        .group_by(cast(Task.created_at, Date))
        .order_by(cast(Task.created_at, Date).asc())
    )
    rows = result.all()

    # Build a complete date range with zeroes for missing days
    date_map: dict[str, dict] = {}
    current = start_date
    while current <= end_date:
        date_map[str(current)] = {"date": str(current), "published": 0, "failed": 0}
        current += timedelta(days=1)

    for row in rows:
        key = str(row.day)
        if key in date_map:
            date_map[key]["published"] = int(row.published or 0)
            date_map[key]["failed"] = int(row.failed or 0)

    return list(date_map.values())
