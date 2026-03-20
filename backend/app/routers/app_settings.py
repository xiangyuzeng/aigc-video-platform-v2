from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import AppSetting, Server

router = APIRouter()


@router.get("/")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Return all app settings as a dict."""
    result = await db.execute(select(AppSetting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


@router.get("/setup/status")
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if first-run setup is needed."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "setup_completed")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value == "true":
        return {"needs_setup": False}

    server_count = await db.execute(select(Server))
    if server_count.scalars().first():
        return {"needs_setup": False}

    return {"needs_setup": True}


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    """Get a single setting by key."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return {"key": key, "value": row.value if row else None}


@router.put("/{key}")
async def set_setting(key: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Set a single setting value."""
    value = body.get("value")
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    await db.commit()
    return {"key": key, "value": value}
