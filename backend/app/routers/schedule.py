from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date, update
from pydantic import BaseModel
from app.database import get_db
from app.models import Task, Profile

router = APIRouter()

# Optimal TikTok posting windows (in target timezone)
OPTIMAL_SLOTS = [
    {"label": "早间 7:00-9:00", "start": "07:00", "end": "09:00"},
    {"label": "午间 12:00-14:00", "start": "12:00", "end": "14:00"},
    {"label": "晚间 18:00-21:00", "start": "18:00", "end": "21:00"},
]


@router.get("/optimal-slots")
async def get_optimal_slots():
    """Return preset optimal posting time slots for TikTok."""
    return OPTIMAL_SLOTS


class StaggerRequest(BaseModel):
    task_ids: list[int]
    start_time: str  # ISO format datetime
    interval_minutes: int = 5  # minutes between each task
    timezone: str = "America/Mexico_City"


@router.post("/stagger")
async def stagger_tasks(body: StaggerRequest, db: AsyncSession = Depends(get_db)):
    """Stagger scheduled times for a list of tasks, spacing them apart."""
    if body.interval_minutes < 1 or body.interval_minutes > 60:
        raise HTTPException(status_code=400, detail="间隔必须在1-60分钟之间")

    base_time = datetime.fromisoformat(body.start_time)
    updated = []

    for i, task_id in enumerate(body.task_ids):
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            continue
        scheduled = base_time + timedelta(minutes=i * body.interval_minutes)
        task.scheduled_at = scheduled
        task.timezone = body.timezone
        task.status = "queued"
        updated.append({"task_id": task.id, "scheduled_at": scheduled.isoformat()})

    await db.commit()
    return {"updated": updated, "count": len(updated)}


@router.get("/queue")
async def get_schedule_queue(
    date_from: str | None = None,
    date_to: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return scheduled tasks as a queue, with optional date and status filters."""
    query = (
        select(Task)
        .where(Task.scheduled_at.isnot(None))
        .order_by(Task.scheduled_at.asc())
    )

    if date_from:
        query = query.where(Task.scheduled_at >= datetime.fromisoformat(date_from))
    if date_to:
        to_dt = datetime.fromisoformat(date_to) + timedelta(days=1)
        query = query.where(Task.scheduled_at < to_dt)
    if status:
        query = query.where(Task.status == status)

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": t.id,
            "task_name": t.task_name,
            "profile_id": t.profile_id,
            "video_id": t.video_id,
            "status": t.status,
            "scheduled_at": t.scheduled_at.isoformat() if t.scheduled_at else None,
            "timezone": t.timezone,
            "error_message": t.error_message,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


@router.post("/retry/{task_id}")
async def retry_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Retry a failed task by resetting its status to queued."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "failed":
        raise HTTPException(status_code=400, detail="只能重试失败的任务")
    task.status = "queued"
    task.error_message = None
    task.retry_count += 1
    await db.commit()
    return {"ok": True, "task_id": task.id}


@router.get("/calendar")
async def get_calendar_data(
    year: int | None = None,
    month: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return task counts per day for a calendar view."""
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month

    start = datetime(y, m, 1)
    if m == 12:
        end = datetime(y + 1, 1, 1)
    else:
        end = datetime(y, m + 1, 1)

    result = await db.execute(
        select(
            cast(Task.scheduled_at, Date).label("day"),
            func.count().label("total"),
            func.sum(case((Task.status == "published", 1), else_=0)).label("published"),
            func.sum(case((Task.status == "failed", 1), else_=0)).label("failed"),
            func.sum(case((Task.status == "queued", 1), else_=0)).label("queued"),
        )
        .where(Task.scheduled_at >= start)
        .where(Task.scheduled_at < end)
        .group_by(cast(Task.scheduled_at, Date))
    )

    return [
        {
            "date": str(row.day),
            "total": int(row.total),
            "published": int(row.published or 0),
            "failed": int(row.failed or 0),
            "queued": int(row.queued or 0),
        }
        for row in result.all()
    ]
