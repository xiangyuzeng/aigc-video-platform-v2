import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db, AsyncSessionLocal
from app.models import Task, Profile, Video, Server
from app.schemas import TaskCreate, TaskUpdate, TaskResponse
from app.services.adspower import AdsPowerService
from app.services.publisher import PublishEngine
from app.routers.tags import format_tags
from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    status: str | None = None,
    task_name: str | None = None,
    profile_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).order_by(Task.created_at.desc())
    if status:
        stmt = stmt.where(Task.status == status)
    if task_name:
        stmt = stmt.where(Task.task_name == task_name)
    if profile_id:
        stmt = stmt.where(Task.profile_id == profile_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(**body.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/bulk", response_model=list[TaskResponse])
async def bulk_create_tasks(body: list[TaskCreate], db: AsyncSession = Depends(get_db)):
    tasks = [Task(**item.model_dump()) for item in body]
    for t in tasks:
        t.status = "queued"  # wizard-created tasks are ready to execute
    db.add_all(tasks)
    await db.commit()
    for t in tasks:
        await db.refresh(t)
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, body: TaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return {"ok": True}


@router.post("/execute")
async def execute_tasks(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.status == "queued")
        .options(selectinload(Task.profile).selectinload(Profile.server))
        .options(selectinload(Task.video))
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    if not tasks:
        return {"ok": True, "task_count": 0}

    # Snapshot the data needed for background execution
    tasks_data = []
    for t in tasks:
        tasks_data.append((t.id, t.profile.profile_id, t.profile.server.base_url, t.video_id))

    task_count = len(tasks)

    async def _run_in_background(task_ids_and_data):
        # Wait for frontend to connect WebSocket before starting
        await asyncio.sleep(2)
        try:
            async with AsyncSessionLocal() as session:
                # Build the AdsPower service from the first task's server
                first_base_url = task_ids_and_data[0][2]
                ads = AdsPowerService(first_base_url)
                engine = PublishEngine(ads)
                logger.info("Starting background execution for %d tasks", len(task_ids_and_data))

                for task_id, profile_id_str, base_url, video_id in task_ids_and_data:
                    logger.info("Executing task %d (profile=%s, video=%d)", task_id, profile_id_str, video_id)
                    task = await session.get(Task, task_id)
                    video = await session.get(Video, video_id)
                    stmt_p = select(Profile).where(Profile.profile_id == profile_id_str)
                    res = await session.execute(stmt_p)
                    profile = res.scalar_one_or_none()

                    if not task or not video or not profile:
                        logger.warning("Skipping task %d: missing task/video/profile", task_id)
                        await ws_manager.broadcast(task_id, "failed", 0, error="Missing task, video, or profile data")
                        if task:
                            task.status = "failed"
                            task.error_message = "Missing video or profile data"
                            task.updated_at = datetime.utcnow()
                            await session.commit()
                        continue

                    task.status = "uploading"
                    task.updated_at = datetime.utcnow()
                    await session.commit()
                    # Broadcast after commit so polling sees the same status
                    await ws_manager.broadcast(task_id, "uploading", 5)

                    try:
                        ok = await engine.execute_task(task, video, profile)
                        if ok:
                            task.status = "published"
                            task.published_at = datetime.utcnow()
                            logger.info("Task %d published successfully", task_id)
                            # Record tags for suggestions
                            if task.tags:
                                try:
                                    from app.models import TagHistory
                                    for tag in format_tags(task.tags):
                                        existing = await session.execute(
                                            select(TagHistory).where(
                                                TagHistory.tag == tag,
                                                TagHistory.platform == (profile.platform or "tiktok"),
                                            )
                                        )
                                        row = existing.scalar_one_or_none()
                                        if row:
                                            row.use_count += 1
                                            row.last_used_at = datetime.utcnow()
                                        else:
                                            session.add(TagHistory(
                                                tag=tag,
                                                platform=profile.platform or "tiktok",
                                                use_count=1,
                                            ))
                                except Exception:
                                    logger.warning("Task %d: failed to record tags", task_id)
                        else:
                            task.status = "failed"
                            task.error_message = engine.last_error or "Publish failed"
                            logger.warning("Task %d failed: %s", task_id, task.error_message)
                    except Exception as e:
                        task.status = "failed"
                        task.error_message = str(e)
                        logger.exception("Task %d failed with exception", task_id)

                    task.updated_at = datetime.utcnow()
                    await session.commit()
                    # Re-broadcast final status after DB commit
                    progress = 100 if task.status == "published" else 0
                    await ws_manager.broadcast(task_id, task.status, progress, error=task.error_message)
                    await asyncio.sleep(2)

                logger.info("Background execution complete")
        except Exception:
            logger.exception("Background task execution crashed")

    asyncio.create_task(_run_in_background(tasks_data))
    return {"ok": True, "task_count": task_count}


@router.post("/{task_id}/retry", response_model=TaskResponse)
async def retry_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed tasks can be retried")
    task.status = "queued"
    task.retry_count += 1
    task.error_message = None
    task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "cancelled"
    task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)
    return task
