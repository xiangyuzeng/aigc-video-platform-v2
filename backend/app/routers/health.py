import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.database import get_db
from app.models import Profile, Task

router = APIRouter()


@router.get("/")
async def get_account_health(db: AsyncSession = Depends(get_db)):
    """Return health stats for all profiles."""
    # Get all profiles
    profiles_result = await db.execute(select(Profile))
    profiles = profiles_result.scalars().all()

    health_data = []
    for profile in profiles:
        # Get task stats for this profile
        stats = await _get_profile_stats(db, profile.id)
        health_score = _calculate_health_score(stats)
        alerts = _generate_alerts(profile, stats)

        health_data.append({
            "profile_id": profile.id,
            "profile_name": profile.profile_name,
            "group_name": profile.group_name,
            "serial_number": profile.serial_number,
            "total_posts": stats["total_posts"],
            "success_rate": stats["success_rate"],
            "last_publish_time": stats["last_publish_time"],
            "avg_interval_hours": stats["avg_interval_hours"],
            "health_score": health_score,
            "alerts": alerts,
        })

    return health_data


@router.get("/export")
async def export_health_csv(db: AsyncSession = Depends(get_db)):
    """Export health data as CSV."""
    # Get all profiles
    profiles_result = await db.execute(select(Profile))
    profiles = profiles_result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["设备名称", "分组", "编号", "发布总数", "成功率(%)", "最后发布", "平均间隔(小时)", "健康分数"])

    for profile in profiles:
        stats = await _get_profile_stats(db, profile.id)
        health_score = _calculate_health_score(stats)
        writer.writerow([
            profile.profile_name,
            profile.group_name or "-",
            profile.serial_number or "-",
            stats["total_posts"],
            round(stats["success_rate"], 1),
            stats["last_publish_time"] or "-",
            round(stats["avg_interval_hours"], 1) if stats["avg_interval_hours"] else "-",
            health_score,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=account_health.csv"},
    )


async def _get_profile_stats(db: AsyncSession, profile_id: int) -> dict:
    """Calculate publishing stats for a single profile."""
    # Total posts and success/failure counts
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((Task.status == "published", 1), else_=0)).label("published"),
            func.sum(case((Task.status == "failed", 1), else_=0)).label("failed"),
        )
        .where(Task.profile_id == profile_id)
        .where(Task.status.in_(["published", "failed"]))
    )
    row = result.one()
    total_posts = int(row.total or 0)
    published_count = int(row.published or 0)
    failed_count = int(row.failed or 0)

    success_rate = (published_count / total_posts * 100) if total_posts > 0 else 0.0

    # Last publish time
    last_result = await db.execute(
        select(Task.published_at)
        .where(Task.profile_id == profile_id)
        .where(Task.status == "published")
        .order_by(Task.published_at.desc())
        .limit(1)
    )
    last_row = last_result.scalar_one_or_none()
    last_publish_time = last_row.isoformat() if last_row else None

    # Average interval between publishes
    published_times_result = await db.execute(
        select(Task.published_at)
        .where(Task.profile_id == profile_id)
        .where(Task.status == "published")
        .where(Task.published_at.isnot(None))
        .order_by(Task.published_at.asc())
    )
    times = [row[0] for row in published_times_result.all()]
    avg_interval_hours = None
    if len(times) >= 2:
        intervals = [(times[i+1] - times[i]).total_seconds() / 3600 for i in range(len(times)-1)]
        avg_interval_hours = sum(intervals) / len(intervals)

    # Consecutive failures (most recent)
    recent_result = await db.execute(
        select(Task.status)
        .where(Task.profile_id == profile_id)
        .where(Task.status.in_(["published", "failed"]))
        .order_by(Task.created_at.desc())
        .limit(10)
    )
    recent_statuses = [row[0] for row in recent_result.all()]
    consecutive_failures = 0
    for s in recent_statuses:
        if s == "failed":
            consecutive_failures += 1
        else:
            break

    return {
        "total_posts": total_posts,
        "published_count": published_count,
        "success_rate": success_rate,
        "last_publish_time": last_publish_time,
        "avg_interval_hours": avg_interval_hours,
        "consecutive_failures": consecutive_failures,
    }


def _calculate_health_score(stats: dict) -> int:
    """Calculate health score 0-100 based on activity and success rate."""
    score = 0

    # Success rate component (0-40 points)
    score += min(40, stats["success_rate"] * 0.4)

    # Activity component (0-30 points) — based on having posts
    if stats["total_posts"] >= 10:
        score += 30
    elif stats["total_posts"] >= 5:
        score += 20
    elif stats["total_posts"] >= 1:
        score += 10

    # Recency component (0-30 points) — based on last publish time
    if stats["last_publish_time"]:
        last = datetime.fromisoformat(stats["last_publish_time"])
        days_ago = (datetime.utcnow() - last).days
        if days_ago <= 1:
            score += 30
        elif days_ago <= 3:
            score += 20
        elif days_ago <= 7:
            score += 10

    return min(100, round(score))


def _generate_alerts(profile, stats: dict) -> list[str]:
    """Generate alert messages for a profile."""
    alerts = []

    # No activity alert
    if stats["last_publish_time"]:
        last = datetime.fromisoformat(stats["last_publish_time"])
        days_ago = (datetime.utcnow() - last).days
        if days_ago >= 3:
            alerts.append(f"已{days_ago}天未发布")
    elif stats["total_posts"] == 0:
        alerts.append("从未发布过")

    # Consecutive failure alert
    if stats["consecutive_failures"] >= 3:
        alerts.append(f"连续失败{stats['consecutive_failures']}次")

    # Low success rate alert
    if stats["total_posts"] >= 3 and stats["success_rate"] < 50:
        alerts.append(f"成功率仅{stats['success_rate']:.0f}%")

    return alerts
