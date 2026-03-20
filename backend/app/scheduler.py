import asyncio
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import Task, Profile

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None


async def check_scheduled_tasks():
    """Poll for tasks where scheduled_at <= now and status='queued', then execute."""
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        from sqlalchemy import or_
        stmt = (
            select(Task)
            .where(
                Task.status == "queued",
                or_(
                    Task.scheduled_at.is_(None),        # immediate tasks
                    Task.scheduled_at <= now,            # scheduled tasks whose time has come
                ),
            )
            .options(selectinload(Task.profile).selectinload(Profile.server))
            .options(selectinload(Task.video))
        )
        result = await db.execute(stmt)
        tasks = result.scalars().all()

        if not tasks:
            return

        logger.info(f"Found {len(tasks)} scheduled tasks to execute")

        from app.services.adspower import AdsPowerService
        from app.services.publisher import PublishEngine

        for task in tasks:
            try:
                ads = AdsPowerService(task.profile.server.base_url)
                engine = PublishEngine(ads)

                task.status = "uploading"
                task.updated_at = datetime.utcnow()
                await db.commit()

                ok = await engine.execute_task(task, task.video, task.profile)
                if ok:
                    task.status = "published"
                    task.published_at = datetime.utcnow()
                else:
                    task.status = "failed"
                    task.error_message = "Publish failed"

                task.updated_at = datetime.utcnow()
                await db.commit()
            except Exception as e:
                logger.error(f"Scheduled task {task.id} failed: {e}")
                task.status = "failed"
                task.error_message = str(e)
                task.updated_at = datetime.utcnow()
                await db.commit()


async def _scheduler_loop():
    """Background loop that checks for scheduled tasks every 60 seconds."""
    while True:
        try:
            await check_scheduled_tasks()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(60)


def start_scheduler():
    global _task
    try:
        loop = asyncio.get_running_loop()
        _task = loop.create_task(_scheduler_loop())
        logger.info("Task scheduler started, polling every 60 seconds")
    except RuntimeError:
        logger.warning("No running event loop, scheduler not started")


def stop_scheduler():
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("Task scheduler stopped")
