from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import json

from app.database import get_db
from app.models import Product
from app.schemas import ProductCreate, ProductResponse, ProductListResponse, ScrapeRequest

router = APIRouter()

@router.get("/", response_model=ProductListResponse)
async def list_products(search: str | None = None, skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(Product)
    count_query = select(func.count(Product.id))
    if search:
        pattern = f"%{search}%"
        query = query.where(Product.name.ilike(pattern))
        count_query = count_query.where(Product.name.ilike(pattern))
    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Product.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(query)).scalars().all()
    return ProductListResponse(items=rows, total=total)

@router.post("/", response_model=ProductResponse)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
    return {"ok": True}

@router.post("/scrape", response_model=ProductResponse)
async def scrape_product(data: ScrapeRequest, db: AsyncSession = Depends(get_db)):
    """Scrape product info from a URL and save to DB.

    If the scraper couldn't extract price/category and an Anthropic API key
    is configured, auto-scores the product to enrich missing fields.
    """
    from app.services.product_scraper import scrape_tiktok_product
    try:
        result = await scrape_tiktok_product(data.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    product = Product(
        name=result["name"],
        category=result.get("category") or None,
        price=result.get("price"),
        source_url=result.get("source_url", data.url),
        image_urls_json=json.dumps(result.get("image_urls", [])),
        description=result.get("description") or None,
        raw_data_json=json.dumps(result.get("raw_data", {})),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Auto-score if API key is available to enrich missing data
    from app.config import settings
    if settings.anthropic_api_key:
        try:
            from app.services.product_scorer import score_product as do_score
            score, reasoning, angles = await do_score(
                name=product.name,
                category=product.category or "",
                price=product.price,
                description=product.description or "",
            )
            product.score = score
            product.score_reasoning = reasoning
            product.suggested_angles_json = json.dumps(angles)
            await db.commit()
            await db.refresh(product)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Auto-score after scrape failed: %s", e)

    return product

@router.post("/{product_id}/score")
async def score_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Score a product's viral potential using AI."""
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from app.services.product_scorer import score_product as do_score
    try:
        score, reasoning, angles = await do_score(
            name=product.name,
            category=product.category or "",
            price=product.price,
            description=product.description or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    product.score = score
    product.score_reasoning = reasoning
    product.suggested_angles_json = json.dumps(angles)
    await db.commit()
    await db.refresh(product)
    return ProductResponse.model_validate(product)
