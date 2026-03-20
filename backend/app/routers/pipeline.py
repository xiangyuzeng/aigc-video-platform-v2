import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db, AsyncSessionLocal
from app.models import PipelineRun, Product
from app.schemas import PipelineRunCreate, PipelineRunResponse, PipelineRunListResponse
from app.services import pipeline_state

router = APIRouter()

@router.get("/runs", response_model=PipelineRunListResponse)
async def list_runs(status: str | None = None, skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(PipelineRun)
    count_query = select(func.count(PipelineRun.id))
    if status:
        query = query.where(PipelineRun.status == status)
        count_query = count_query.where(PipelineRun.status == status)
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(PipelineRun.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(query)).scalars().all()
    return PipelineRunListResponse(items=rows, total=total)

@router.get("/runs/{run_id}", response_model=PipelineRunResponse)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = (await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return run

@router.post("/run", response_model=PipelineRunResponse)
async def start_pipeline(data: PipelineRunCreate, db: AsyncSession = Depends(get_db)):
    # Verify product exists
    product = (await db.execute(select(Product).where(Product.id == data.product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Initialize stages
    stages = pipeline_state.get_stages_for_source(data.video_source)
    stages_json = pipeline_state.init_stages_json(stages)

    run = PipelineRun(
        product_id=data.product_id,
        style=data.style,
        video_source=data.video_source,
        uploaded_video_path=data.uploaded_video_path,
        target_profile_ids_json=json.dumps(data.target_profile_ids),
        schedule_time=data.schedule_time,
        timezone=data.timezone,
        status="draft",
        current_stage="init",
        stages_json=stages_json,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Launch pipeline in background
    async def _run_bg(run_id: int):
        from app.services.pipeline_orchestrator import run_pipeline
        async with AsyncSessionLocal() as session:
            try:
                await run_pipeline(run_id, session)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error("Pipeline %d crashed: %s", run_id, e)
                r = await session.get(PipelineRun, run_id)
                if r:
                    r.status = "failed"
                    r.error_message = str(e)
                    r.updated_at = datetime.utcnow()
                    await session.commit()

    asyncio.create_task(_run_bg(run.id))
    return run

@router.post("/runs/{run_id}/resume", response_model=PipelineRunResponse)
async def resume_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = (await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    if run.status not in ("failed", "cancelled"):
        raise HTTPException(status_code=400, detail="Can only resume failed or cancelled runs")

    run.status = "running"
    run.error_message = None
    run.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(run)

    async def _run_bg(rid: int):
        from app.services.pipeline_orchestrator import run_pipeline
        async with AsyncSessionLocal() as session:
            try:
                await run_pipeline(rid, session)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error("Pipeline %d resume crashed: %s", rid, e)

    asyncio.create_task(_run_bg(run.id))
    return run

@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = (await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    run.status = "cancelled"
    run.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}

@router.delete("/runs/{run_id}")
async def delete_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = (await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    await db.delete(run)
    await db.commit()
    return {"ok": True}
