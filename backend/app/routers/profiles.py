from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Profile, Task
from app.schemas import ProfileResponse, ProfileUpdate

router = APIRouter()


@router.get("/", response_model=list[ProfileResponse])
async def list_profiles(
    server_id: int | None = None,
    group_name: str | None = None,
    platform: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Profile)

    if server_id is not None:
        query = query.where(Profile.server_id == server_id)
    if group_name is not None:
        query = query.where(Profile.group_name == group_name)
    if platform is not None:
        query = query.where(Profile.platform == platform)
    if search is not None:
        query = query.where(Profile.profile_name.ilike(f"%{search}%"))

    query = query.order_by(Profile.profile_name.asc())

    result = await db.execute(query)
    profiles = result.scalars().all()
    return profiles


@router.get("/groups", response_model=list[str])
async def list_groups(db: AsyncSession = Depends(get_db)):
    query = (
        select(Profile.group_name)
        .distinct()
        .where(Profile.group_name.isnot(None))
        .order_by(Profile.group_name)
    )
    result = await db.execute(query)
    groups = result.scalars().all()
    return groups


@router.patch("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: int,
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{profile_id}")
async def delete_profile(profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Delete associated tasks first
    task_result = await db.execute(select(Task).where(Task.profile_id == profile_id))
    for task in task_result.scalars().all():
        await db.delete(task)

    await db.delete(profile)
    await db.commit()
    return {"ok": True}
