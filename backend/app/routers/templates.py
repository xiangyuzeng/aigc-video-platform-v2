import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import Template

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    content_template: str | None = None
    tags_template: str | None = None
    category: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    content_template: str | None = None
    tags_template: str | None = None
    category: str | None = None


class TemplateApply(BaseModel):
    variables: dict[str, str] = {}


@router.get("/")
async def list_templates(category: str | None = None, db: AsyncSession = Depends(get_db)):
    """List all templates, optionally filtered by category."""
    query = select(Template).order_by(Template.created_at.desc())
    if category:
        query = query.where(Template.category == category)
    result = await db.execute(query)
    templates = result.scalars().all()
    return [_serialize(t) for t in templates]


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all distinct template categories."""
    result = await db.execute(
        select(Template.category).where(Template.category.isnot(None)).distinct()
    )
    return [row[0] for row in result.all()]


@router.post("/")
async def create_template(body: TemplateCreate, db: AsyncSession = Depends(get_db)):
    """Create a new template. Auto-extracts variable names from {placeholders}."""
    variables = _extract_variables(body.content_template, body.tags_template)
    template = Template(
        name=body.name,
        content_template=body.content_template,
        tags_template=body.tags_template,
        variables_json=json.dumps(variables),
        category=body.category,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _serialize(template)


@router.get("/{template_id}")
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    """Get a template by ID."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return _serialize(template)


@router.put("/{template_id}")
async def update_template(template_id: int, body: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing template."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    if body.name is not None:
        template.name = body.name
    if body.content_template is not None:
        template.content_template = body.content_template
    if body.tags_template is not None:
        template.tags_template = body.tags_template
    if body.category is not None:
        template.category = body.category
    # Re-extract variables
    variables = _extract_variables(template.content_template, template.tags_template)
    template.variables_json = json.dumps(variables)
    await db.commit()
    await db.refresh(template)
    return _serialize(template)


@router.delete("/{template_id}")
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a template."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    await db.delete(template)
    await db.commit()
    return {"ok": True}


@router.post("/{template_id}/apply")
async def apply_template(template_id: int, body: TemplateApply, db: AsyncSession = Depends(get_db)):
    """Apply a template with variable substitution. Returns rendered content and tags."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    content = _substitute(template.content_template, body.variables)
    tags = _substitute(template.tags_template, body.variables)
    return {"content": content, "tags": tags}


def _extract_variables(content: str | None, tags: str | None) -> list[str]:
    """Extract {variable_name} placeholders from content and tags."""
    text = (content or "") + " " + (tags or "")
    return list(set(re.findall(r'\{(\w+)\}', text)))


def _substitute(template: str | None, variables: dict[str, str]) -> str | None:
    if not template:
        return template
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", value)
    return result


def _serialize(t: Template) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "content_template": t.content_template,
        "tags_template": t.tags_template,
        "variables": json.loads(t.variables_json) if t.variables_json else [],
        "category": t.category,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }
