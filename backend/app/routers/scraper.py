import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ScrapedContent, Server
from app.services.adspower import AdsPowerService
from app.services.scraper import FastMossScraper

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str
    profile_id: str  # AdsPower scraper profile ID


class ScrapeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_url: str
    original_content: Optional[str]
    original_tags: Optional[str]
    translated_content: Optional[str]
    translated_tags: Optional[str]
    scraped_at: datetime


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_default_server(db: AsyncSession) -> Server:
    """Return the default Server row or raise 404."""
    result = await db.execute(
        select(Server).where(Server.is_default == True).limit(1)  # noqa: E712
    )
    server = result.scalar_one_or_none()
    if server is None:
        # Fall back to any server if none is marked default
        result = await db.execute(select(Server).limit(1))
        server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=404,
            detail="No AdsPower server configured. Add a server first.",
        )
    return server


# ---------------------------------------------------------------------------
# POST /scrape
# ---------------------------------------------------------------------------

@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_video(
    body: ScrapeRequest,
    db: AsyncSession = Depends(get_db),
) -> ScrapeResponse:
    """
    Scrape a FastMoss video page using the specified AdsPower profile.
    Saves the result to ScrapedContent and returns the saved row.
    """
    server = await _get_default_server(db)

    ads = AdsPowerService(base_url=server.base_url)
    scraper = FastMossScraper(ads=ads, scraper_profile_id=body.profile_id)

    try:
        data = await scraper.scrape_video(body.url)
    except Exception as exc:
        logger.exception("Scrape failed for url=%s profile=%s", body.url, body.profile_id)
        raise HTTPException(status_code=500, detail=f"Scrape failed: {exc}") from exc

    record = ScrapedContent(
        source_url=body.url,
        original_content=data.get("content") or None,
        original_tags=data.get("tags") or None,
        translated_content=data.get("trans_content") or None,
        translated_tags=data.get("trans_tags") or None,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return ScrapeResponse.model_validate(record)


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------

@router.get("/history", response_model=list[ScrapeResponse])
async def list_scrape_history(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[ScrapeResponse]:
    """
    Return previously scraped content ordered by scraped_at DESC.
    Supports pagination via limit/offset query parameters.
    """
    result = await db.execute(
        select(ScrapedContent)
        .order_by(ScrapedContent.scraped_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    return [ScrapeResponse.model_validate(row) for row in rows]
