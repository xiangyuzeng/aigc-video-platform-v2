from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Draft
from app.schemas import DraftCreate, DraftResponse

router = APIRouter()


@router.get("/", response_model=list[DraftResponse])
async def list_drafts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Draft).order_by(Draft.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=DraftResponse, status_code=201)
async def create_draft(payload: DraftCreate, db: AsyncSession = Depends(get_db)):
    draft = Draft(**payload.model_dump())
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: int, db: AsyncSession = Depends(get_db)):
    draft = (await db.execute(select(Draft).where(Draft.id == draft_id))).scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.delete("/{draft_id}")
async def delete_draft(draft_id: int, db: AsyncSession = Depends(get_db)):
    draft = (await db.execute(select(Draft).where(Draft.id == draft_id))).scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    await db.delete(draft)
    await db.commit()
    return {"ok": True}
