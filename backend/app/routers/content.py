from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from app.database import get_db
from app.config import settings
from app.models import Product, ContentPiece
from app.schemas import ContentGenerateRequest, ScriptGenerateRequest, ContentPieceResponse, TranslateRequest

router = APIRouter()

@router.get("/", response_model=list[ContentPieceResponse])
async def list_content(product_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(ContentPiece)
    if product_id is not None:
        query = query.where(ContentPiece.product_id == product_id)
    query = query.order_by(ContentPiece.created_at.desc()).limit(50)
    rows = (await db.execute(query)).scalars().all()
    return rows

@router.get("/{content_id}", response_model=ContentPieceResponse)
async def get_content(content_id: int, db: AsyncSession = Depends(get_db)):
    cp = (await db.execute(select(ContentPiece).where(ContentPiece.id == content_id))).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Content not found")
    return cp

@router.post("/generate", response_model=ContentPieceResponse)
async def generate_content(data: ContentGenerateRequest, db: AsyncSession = Depends(get_db)):
    product = (await db.execute(select(Product).where(Product.id == data.product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from app.services.copywriter import generate_content as do_generate
    angles = json.loads(product.suggested_angles_json) if product.suggested_angles_json else []

    try:
        result = await do_generate(
            product_name=product.name,
            product_category=product.category or "",
            product_price=product.price,
            product_description=product.description or "",
            style=data.style,
            suggested_angles=angles,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    cp = ContentPiece(
        product_id=product.id,
        caption=result.get("caption", ""),
        tags_json=json.dumps(result.get("hashtags", [])),
        description=result.get("description", ""),
        style=data.style,
        language=settings.content_primary_language,
    )
    db.add(cp)
    await db.commit()
    await db.refresh(cp)
    return cp

@router.post("/generate-script", response_model=ContentPieceResponse)
async def generate_script_endpoint(data: ScriptGenerateRequest, db: AsyncSession = Depends(get_db)):
    product = (await db.execute(select(Product).where(Product.id == data.product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from app.services.script_gen import generate_script

    try:
        script = await generate_script(
            product_name=product.name,
            product_category=product.category or "",
            product_price=product.price,
            product_description=product.description or "",
            style=data.style,
            duration=data.duration,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Find latest content piece for this product or create new
    existing = (await db.execute(
        select(ContentPiece)
        .where(ContentPiece.product_id == product.id)
        .order_by(ContentPiece.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if existing:
        existing.script_json = json.dumps(script)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        cp = ContentPiece(
            product_id=product.id,
            script_json=json.dumps(script),
            style=data.style,
            language=settings.content_primary_language,
        )
        db.add(cp)
        await db.commit()
        await db.refresh(cp)
        return cp

@router.post("/{content_id}/translate", response_model=ContentPieceResponse)
async def translate_content(content_id: int, data: TranslateRequest, db: AsyncSession = Depends(get_db)):
    cp = (await db.execute(select(ContentPiece).where(ContentPiece.id == content_id))).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Content not found")

    from app.services.copywriter import translate_content as do_translate

    translations = json.loads(cp.translations_json) if cp.translations_json else {}
    tags = json.loads(cp.tags_json) if cp.tags_json else []

    for lang in data.languages:
        try:
            result = await do_translate(
                caption=cp.caption or "",
                hashtags=tags,
                description=cp.description or "",
                target_language=lang,
            )
            if result:
                translations[lang] = result
        except Exception as e:
            # log but continue
            import logging
            logging.getLogger(__name__).warning("Translation to %s failed: %s", lang, e)

    cp.translations_json = json.dumps(translations)
    await db.commit()
    await db.refresh(cp)
    return cp
