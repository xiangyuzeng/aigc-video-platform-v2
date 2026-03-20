"""Main pipeline orchestration engine.

Executes end-to-end pipeline runs: content generation -> script -> video -> subtitles
-> finalization -> publish. Called as a background task from the API layer.
"""

import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import PipelineError, VideoError
from app.models import ContentPiece, PipelineRun, Product, Task, Video
from app.services import pipeline_state
from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)


async def run_pipeline(run_id: int, db: AsyncSession) -> None:
    """Execute a pipeline run. Called as a background task."""
    run = await db.get(PipelineRun, run_id)
    if not run:
        raise PipelineError(f"Pipeline run {run_id} not found")

    product = await db.get(Product, run.product_id)
    if not product:
        raise PipelineError(f"Product {run.product_id} not found")

    stages = json.loads(run.stages_json) if run.stages_json else []

    run.status = "running"
    run.updated_at = datetime.utcnow()
    await db.commit()

    # Broadcast start
    await ws_manager.broadcast_pipeline(run.id, "running", run.current_stage, 0)

    stage_handlers = {
        "content_generation": _do_content,
        "script_generation": _do_script,
        "image_generation": _do_images,
        "tts_generation": _do_tts,
        "video_assembly": _do_video_assembly,
        "ai_video_generation": _do_ai_video,
        "subtitle_generation": _do_subtitles,
        "video_finalization": _do_video_final,
        "publish": _do_publish,
    }

    total = len(stages)
    for i, stage_info in enumerate(stages):
        # Check for cancellation between stages
        await db.refresh(run)
        if run.status == "cancelled":
            logger.info("Pipeline %d cancelled by user", run.id)
            await ws_manager.broadcast_pipeline(run.id, "cancelled", run.current_stage, 0)
            return

        stage_name = stage_info["stage"]
        if stage_info["status"] == "completed":
            continue  # Skip already completed stages (resume support)

        handler = stage_handlers.get(stage_name)
        if not handler:
            continue

        # Mark running
        run.current_stage = stage_name
        run.stages_json = pipeline_state.update_stage_status(
            run.stages_json, stage_name, "running"
        )
        run.updated_at = datetime.utcnow()
        await db.commit()
        progress = int((i / total) * 100)
        await ws_manager.broadcast_pipeline(run.id, "running", stage_name, progress)

        try:
            output = await handler(run, product, db)
            run.stages_json = pipeline_state.update_stage_status(
                run.stages_json, stage_name, "completed", output_data=output
            )
            run.updated_at = datetime.utcnow()
            await db.commit()
        except Exception as e:
            logger.error("Pipeline %d stage %s failed: %s", run.id, stage_name, e)
            run.stages_json = pipeline_state.update_stage_status(
                run.stages_json, stage_name, "failed", error=str(e)
            )
            run.status = "failed"
            run.error_message = f"Stage '{stage_name}' failed: {e}"
            run.updated_at = datetime.utcnow()
            await db.commit()
            await ws_manager.broadcast_pipeline(
                run.id, "failed", stage_name, progress, error=str(e)
            )
            return

    # All done
    run.status = "completed"
    run.current_stage = "completed"
    run.completed_at = datetime.utcnow()
    run.updated_at = datetime.utcnow()
    await db.commit()
    await ws_manager.broadcast_pipeline(run.id, "completed", "completed", 100)


# ── Stage handlers ──────────────────────────────────────────────
# Each returns a dict of output data that gets stored in stages_json.


async def _do_content(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    from app.services.copywriter import generate_content

    angles = (
        json.loads(product.suggested_angles_json)
        if product.suggested_angles_json
        else []
    )
    result = await generate_content(
        product_name=product.name,
        product_category=product.category or "",
        product_price=product.price,
        product_description=product.description or "",
        style=run.style,
        suggested_angles=angles,
    )

    # Save as ContentPiece
    cp = ContentPiece(
        product_id=product.id,
        caption=result.get("caption", ""),
        tags_json=json.dumps(result.get("hashtags", [])),
        description=result.get("description", ""),
        style=run.style,
        language=settings.content_primary_language,
    )
    db.add(cp)
    await db.flush()

    run.content_piece_id = cp.id
    return {"content_piece_id": cp.id, "caption": result.get("caption", "")[:100]}


async def _do_script(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    from app.services.script_gen import generate_script

    # Veo generates ~5-8s clips, so use short duration for AI video source
    duration = 8 if run.video_source == "kie" else 30

    script = await generate_script(
        product_name=product.name,
        product_category=product.category or "",
        product_price=product.price,
        product_description=product.description or "",
        style=run.style,
        duration=duration,
    )

    # Update content piece with script
    if run.content_piece_id:
        cp = await db.get(ContentPiece, run.content_piece_id)
        if cp:
            cp.script_json = json.dumps(script)
            await db.flush()

    return {"script": script}


async def _do_images(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    from app.services.image_gen import generate_product_image

    image_path = await generate_product_image(
        product_name=product.name,
        product_description=product.description or "",
        style="product_showcase",
        output_dir=str(Path(settings.assets_dir) / "images"),
    )
    return {"image_paths": [image_path]}


async def _do_tts(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    from app.services.script_gen import script_to_voiceover_text
    from app.services.tts import generate_voiceover

    script_output = pipeline_state.get_stage_output(
        run.stages_json, "script_generation"
    )
    script = script_output.get("script", {})
    voiceover_text = script_to_voiceover_text(script)

    if not voiceover_text:
        return {"voiceover_path": "", "skipped": True}

    output_dir = Path(settings.assets_dir) / "render" / str(run.id)
    output_dir.mkdir(parents=True, exist_ok=True)
    voiceover_path = str(output_dir / "voiceover.mp3")

    await generate_voiceover(voiceover_text, voiceover_path)
    return {"voiceover_path": voiceover_path}


async def _do_video_assembly(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    import asyncio

    from app.services.video_editor import VideoEditor

    image_output = pipeline_state.get_stage_output(
        run.stages_json, "image_generation"
    )
    tts_output = pipeline_state.get_stage_output(
        run.stages_json, "tts_generation"
    )

    image_paths = image_output.get("image_paths", [])
    voiceover_path = tts_output.get("voiceover_path", "")

    if not image_paths:
        raise VideoError("No images available for video assembly")

    editor = VideoEditor()
    loop = asyncio.get_running_loop()
    video_path = await loop.run_in_executor(
        None,
        lambda: editor.create_slideshow(
            image_paths=image_paths,
            audio_path=voiceover_path if voiceover_path else None,
            output_name=f"run_{run.id}_base.mp4",
        ),
    )
    return {"base_video_path": str(video_path)}


async def _do_ai_video(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    from app.services.kie_client import KieClient

    script_output = pipeline_state.get_stage_output(
        run.stages_json, "script_generation"
    )
    script = script_output.get("script", {})
    prompt = _build_kie_prompt(product, script)

    output_dir = Path(settings.assets_dir) / "render" / str(run.id)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"run_{run.id}_ai_video.mp4"

    client = KieClient(
        api_key=settings.kie_api_key, base_url=settings.kie_api_url
    )
    try:
        video_path = await client.generate_and_download(
            prompt=prompt,
            output_path=output_path,
            provider=settings.kie_provider,
            aspect_ratio=settings.kie_default_aspect_ratio,
            poll_timeout=settings.kie_poll_timeout,
            poll_interval=settings.kie_poll_interval,
        )
        return {"base_video_path": str(video_path)}
    finally:
        await client.close()


def _build_kie_prompt(product: Product, script: dict) -> str:
    """Build a concise kie.ai Veo prompt (5-8s clip, visual only).

    Veo generates short clips so the prompt must be focused.
    Only visual directions matter — Veo doesn't do voiceover.
    """
    parts = [f"Short product showcase video of {product.name}."]

    # Use the hook visual as the primary scene
    if "hook" in script and isinstance(script["hook"], dict):
        visual = script["hook"].get("visual", "")
        if visual:
            parts.append(visual[:150])

    # Add first sentence of body visual
    if "body" in script and isinstance(script["body"], dict):
        visual = script["body"].get("visual", "")
        if visual:
            first_sentence = visual.split(".")[0].strip()
            if first_sentence:
                parts.append(first_sentence + ".")

    parts.append("Vertical 9:16 format, cinematic lighting, smooth camera movement.")

    # Keep under 500 chars for Veo
    prompt = " ".join(parts)
    if len(prompt) > 500:
        prompt = prompt[:497] + "..."
    return prompt


async def _do_subtitles(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    import asyncio

    from app.services.stt import transcribe_segments

    # Find audio source from previous stages
    audio_path = ""

    tts_output = pipeline_state.get_stage_output(
        run.stages_json, "tts_generation"
    )
    if tts_output:
        audio_path = tts_output.get("voiceover_path", "")

    if not audio_path:
        ai_output = pipeline_state.get_stage_output(
            run.stages_json, "ai_video_generation"
        )
        if ai_output:
            audio_path = ai_output.get("base_video_path", "")

    if not audio_path:
        assembly_output = pipeline_state.get_stage_output(
            run.stages_json, "video_assembly"
        )
        if assembly_output:
            audio_path = assembly_output.get("base_video_path", "")

    if not audio_path and run.uploaded_video_path:
        audio_path = run.uploaded_video_path

    if not audio_path:
        return {"segments": [], "skipped": True}

    loop = asyncio.get_running_loop()
    segments = await loop.run_in_executor(
        None, lambda: transcribe_segments(audio_path)
    )
    return {"segments": segments}


async def _do_video_final(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    import asyncio

    from app.services.video_editor import VideoEditor

    # Find base video from previous stages
    base_path = ""

    ai_output = pipeline_state.get_stage_output(
        run.stages_json, "ai_video_generation"
    )
    if ai_output:
        base_path = ai_output.get("base_video_path", "")

    if not base_path:
        assembly_output = pipeline_state.get_stage_output(
            run.stages_json, "video_assembly"
        )
        if assembly_output:
            base_path = assembly_output.get("base_video_path", "")

    if not base_path and run.uploaded_video_path:
        base_path = run.uploaded_video_path

    subtitle_output = pipeline_state.get_stage_output(
        run.stages_json, "subtitle_generation"
    )
    segments = subtitle_output.get("segments", [])

    if not base_path or not Path(base_path).exists():
        raise VideoError(f"Base video not found at '{base_path}'")

    final_path = base_path
    if segments:
        editor = VideoEditor()
        loop = asyncio.get_running_loop()
        final_path = await loop.run_in_executor(
            None,
            lambda: editor.add_subtitles(
                video_path=base_path,
                segments=segments,
                output_name=f"run_{run.id}_final.mp4",
            ),
        )

    # Save as Video record
    final = Path(final_path)

    # Copy to uploads dir so it's served via the static file route
    dest = Path(settings.upload_dir) / final.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if str(final) != str(dest):
        shutil.copy2(str(final), str(dest))
        final_path = str(dest)

    video = Video(
        title=f"Pipeline #{run.id} - {product.name[:50]}",
        file_path=str(final_path),
        file_size_bytes=os.path.getsize(final_path) if os.path.exists(final_path) else 0,
        status="ready",
    )
    db.add(video)
    await db.flush()

    run.video_id = video.id
    return {"video_id": video.id, "video_path": str(final_path)}


async def _do_publish(
    run: PipelineRun, product: Product, db: AsyncSession
) -> dict:
    """Create Task rows for each target profile, delegating to the existing publish system."""
    target_ids = (
        json.loads(run.target_profile_ids_json)
        if run.target_profile_ids_json
        else []
    )

    if not target_ids or not run.video_id:
        return {"skipped": True, "reason": "no profiles or no video"}

    # Get content from the content piece
    caption = ""
    tags = ""
    trans_content = ""
    trans_tags = ""
    if run.content_piece_id:
        cp = await db.get(ContentPiece, run.content_piece_id)
        if cp:
            caption = cp.caption or ""
            tags_list = json.loads(cp.tags_json) if cp.tags_json else []
            tags = " ".join(tags_list)
            if cp.translations_json:
                translations = json.loads(cp.translations_json)
                for lang, trans in translations.items():
                    trans_content = trans.get("caption", "")
                    trans_tags_list = trans.get("hashtags", [])
                    trans_tags = (
                        " ".join(trans_tags_list)
                        if isinstance(trans_tags_list, list)
                        else str(trans_tags_list)
                    )
                    break  # Use first translation

    task_name = f"pipeline_{run.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    created_tasks: list[Task] = []

    for pid in target_ids:
        task = Task(
            task_name=task_name,
            profile_id=pid,
            video_id=run.video_id,
            content=caption,
            tags=tags,
            trans_content=trans_content,
            trans_tags=trans_tags,
            status="queued",
            scheduled_at=None,  # Immediate by default
            timezone=run.timezone,
        )
        if run.schedule_time:
            try:
                task.scheduled_at = datetime.fromisoformat(run.schedule_time)
            except ValueError:
                pass
        db.add(task)
        created_tasks.append(task)

    await db.flush()
    return {
        "task_count": len(created_tasks),
        "task_ids": [t.id for t in created_tasks],
    }
