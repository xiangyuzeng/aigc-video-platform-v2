from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import TagHistory

router = APIRouter()


def format_tags(raw_tags: str | list[str]) -> list[str]:
    """Auto-format tags: ensure # prefix, deduplicate, clean up.

    Ported from reference AIGCAutomation TagManager.
    """
    if isinstance(raw_tags, str):
        items = raw_tags.replace(",", " ").replace("\n", " ").split()
    else:
        items = list(raw_tags)

    seen: set[str] = set()
    result: list[str] = []

    for tag in items:
        tag = tag.strip().lower()
        if not tag:
            continue
        if not tag.startswith("#"):
            tag = f"#{tag}"
        while tag.startswith("##"):
            tag = tag[1:]
        if tag not in seen:
            seen.add(tag)
            result.append(tag)

    return result


class RecordTagsBody(BaseModel):
    tags: list[str]
    platform: str = "tiktok"


@router.post("/record")
async def record_tags(
    body: RecordTagsBody,
    db: AsyncSession = Depends(get_db),
):
    """Record tag usage — called after successful publish.

    Formats tags, then upserts into TagHistory (increment use_count).
    """
    formatted = format_tags(body.tags)
    recorded = []

    for tag in formatted:
        result = await db.execute(
            select(TagHistory).where(
                TagHistory.tag == tag,
                TagHistory.platform == body.platform,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.use_count += 1
            existing.last_used_at = datetime.utcnow()
        else:
            db.add(TagHistory(tag=tag, platform=body.platform, use_count=1))
        recorded.append(tag)

    await db.commit()
    return {"recorded": recorded}


@router.get("/recent")
async def recent_tags(
    platform: str = "tiktok",
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Recent tags sorted by use_count descending."""
    result = await db.execute(
        select(TagHistory)
        .where(TagHistory.platform == platform)
        .order_by(TagHistory.use_count.desc())
        .limit(limit)
    )
    tags = result.scalars().all()
    return [{"tag": t.tag, "use_count": t.use_count} for t in tags]


@router.get("/suggest")
async def suggest_tags(
    q: str = "",
    platform: str = "tiktok",
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Autocomplete tags by prefix."""
    if not q:
        return []
    result = await db.execute(
        select(TagHistory)
        .where(
            TagHistory.platform == platform,
            TagHistory.tag.ilike(f"%{q}%"),
        )
        .order_by(TagHistory.use_count.desc())
        .limit(limit)
    )
    tags = result.scalars().all()
    return [{"tag": t.tag, "use_count": t.use_count} for t in tags]
