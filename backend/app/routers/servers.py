import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Server, Profile
from app.schemas import ServerCreate, ServerUpdate, ServerResponse
from app.services.adspower import AdsPowerService

router = APIRouter()


@router.get("/", response_model=list[ServerResponse])
async def list_servers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server).order_by(Server.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ServerResponse, status_code=201)
async def create_server(payload: ServerCreate, db: AsyncSession = Depends(get_db)):
    # If this is the first server, make it the default
    count_result = await db.execute(select(func.count()).select_from(Server))
    is_first = count_result.scalar() == 0

    server = Server(**payload.model_dump(), is_default=is_first)
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return server


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    payload: ServerUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    update_data = payload.model_dump(exclude_unset=True)

    # If setting this server as default, clear default on all others first
    if update_data.get("is_default") is True:
        all_result = await db.execute(select(Server).where(Server.is_default == True))
        for s in all_result.scalars().all():
            s.is_default = False

    for field, value in update_data.items():
        setattr(server, field, value)

    await db.commit()
    await db.refresh(server)
    return server


@router.delete("/{server_id}")
async def delete_server(server_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    await db.delete(server)
    await db.commit()
    return {"ok": True}


@router.post("/{server_id}/test")
async def test_connection(server_id: int, db: AsyncSession = Depends(get_db)):
    """Test connection to an AdsPower server."""
    server = (await db.execute(select(Server).where(Server.id == server_id))).scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    ads = AdsPowerService(server.base_url)
    ok, message = await ads.test_connection()

    if ok:
        server.last_connected_at = datetime.utcnow()
        await db.commit()

    return {"ok": ok, "message": message}


@router.post("/{server_id}/sync")
async def sync_profiles(server_id: int, db: AsyncSession = Depends(get_db)):
    """Pull all groups + profiles from AdsPower into DB."""
    server = (await db.execute(select(Server).where(Server.id == server_id))).scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    ads = AdsPowerService(server.base_url)
    try:
        groups = await ads.fetch_groups()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect: {e}")

    count = 0
    now = datetime.utcnow()

    # Also fetch all profiles without group filter to catch ungrouped ("未分组") profiles
    seen_uids: set[str] = set()

    for i, group in enumerate(groups + [{"group_id": "", "group_name": ""}]):
        if i > 0:
            await asyncio.sleep(1.5)  # avoid AdsPower rate limit
        gid = str(group.get("group_id", ""))
        gname = group.get("group_name", "").strip()

        try:
            profiles = await ads.fetch_profiles(group_id=gid if gid else None)
        except Exception:
            await asyncio.sleep(2)
            profiles = await ads.fetch_profiles(group_id=gid if gid else None)
        for p in profiles:
            uid = str(p.get("user_id") or p.get("profile_id") or "")
            if not uid or uid == "None":
                continue
            if uid in seen_uids:
                continue
            seen_uids.add(uid)

            # Use group info from profile itself if available (more accurate for ungrouped)
            p_gname = str(p.get("group_name", "") or gname).strip()
            p_gid = str(p.get("group_id", "") or gid).strip()

            # Upsert: check if profile_id + server_id exists
            existing = (
                await db.execute(
                    select(Profile).where(
                        Profile.server_id == server_id,
                        Profile.profile_id == uid,
                    )
                )
            ).scalar_one_or_none()

            name = str(p.get("name") or p.get("profile_name") or uid)
            serial = str(p.get("serial_number") or p.get("profile_no") or "")

            if existing:
                existing.profile_name = name
                existing.group_id = p_gid
                existing.group_name = p_gname
                existing.serial_number = serial
                existing.last_synced_at = now
            else:
                db.add(Profile(
                    server_id=server_id,
                    profile_id=uid,
                    profile_name=name,
                    group_id=p_gid,
                    group_name=p_gname,
                    serial_number=serial,
                    last_synced_at=now,
                ))
            count += 1

    server.last_connected_at = now
    await db.commit()
    return {"ok": True, "synced": count}
