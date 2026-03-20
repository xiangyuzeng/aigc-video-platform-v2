"""DALL-E image generation and video thumbnail extraction.

Generates product showcase images via OpenAI's DALL-E 3 API and
extracts video thumbnails using ffmpeg.
"""

import asyncio
import logging
from pathlib import Path

import httpx

from app.config import settings
from app.errors import ContentGenerationError

logger = logging.getLogger(__name__)

_STYLE_PROMPTS: dict[str, str] = {
    "product_showcase": (
        "Professional product photography on a clean white background, "
        "studio lighting, high resolution, e-commerce style"
    ),
    "lifestyle": (
        "Lifestyle product photography in a natural setting, warm tones, "
        "Instagram-worthy, aspirational"
    ),
    "minimal": (
        "Minimalist product photo, soft shadows, neutral background, "
        "modern aesthetic"
    ),
    "vibrant": (
        "Colorful and vibrant product photography, eye-catching, "
        "bold colors, social media optimized"
    ),
}


async def generate_product_image(
    product_name: str,
    product_description: str,
    style: str = "product_showcase",
    output_dir: str | None = None,
) -> str:
    """Generate a product image using DALL-E 3.

    Args:
        product_name: Name of the product.
        product_description: Description for image context.
        style: Image style key from _STYLE_PROMPTS.
        output_dir: Directory to save the image (defaults to settings.assets_dir/images).

    Returns:
        Local file path of the generated image.

    Raises:
        ContentGenerationError on failure.
    """
    if not settings.openai_api_key:
        raise ContentGenerationError(
            "OpenAI API key not configured (OPENAI_API_KEY)",
        )

    style_desc = _STYLE_PROMPTS.get(style, _STYLE_PROMPTS["product_showcase"])
    prompt = f"{product_name}. {product_description[:200]}. {style_desc}"

    out_dir = Path(output_dir) if output_dir else Path(settings.assets_dir) / "images"
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Request image generation
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1024x1792",  # Portrait for TikTok
                    "quality": "standard",
                    "response_format": "url",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            image_url = data["data"][0]["url"]
            revised_prompt = data["data"][0].get("revised_prompt", "")
            logger.debug("DALL-E revised prompt: %s", revised_prompt[:200])

            # Download the image
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()

            # Generate filename from product name
            safe_name = "".join(
                c if c.isalnum() or c in "-_" else "_"
                for c in product_name[:40]
            ).strip("_")
            import time
            filename = f"{safe_name}_{int(time.time())}.png"
            output_path = out_dir / filename
            output_path.write_bytes(img_resp.content)

            logger.info("Generated product image -> %s", output_path)
            return str(output_path)

    except httpx.HTTPStatusError as exc:
        raise ContentGenerationError(
            f"OpenAI API error: HTTP {exc.response.status_code}",
            details={"response": exc.response.text[:300]},
        ) from exc
    except httpx.HTTPError as exc:
        raise ContentGenerationError(
            f"Network error calling OpenAI: {exc}",
        ) from exc
    except (KeyError, IndexError) as exc:
        raise ContentGenerationError(
            f"Unexpected DALL-E response format: {exc}",
        ) from exc


async def generate_thumbnail(
    video_path: str,
    output_dir: str | None = None,
) -> str:
    """Extract a thumbnail frame from a video at the 1-second mark.

    Args:
        video_path: Path to the video file.
        output_dir: Directory to save the thumbnail (defaults to same dir as video).

    Returns:
        Path to the thumbnail image.
    """
    video = Path(video_path)
    if not video.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    out_dir = Path(output_dir) if output_dir else video.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    output_path = out_dir / f"{video.stem}_thumb.jpg"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video),
        "-ss", "1",
        "-vframes", "1",
        "-q:v", "2",
        str(output_path),
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace")[:500]
        raise RuntimeError(f"ffmpeg thumbnail extraction failed: {error_msg}")

    logger.info("Generated thumbnail -> %s", output_path)
    return str(output_path)
