"""Claude-based video script generation for TikTok product content.

Generates structured video scripts with hook, body, and CTA sections,
each containing text, visual direction, and timing.
"""

import json
import logging
import re

from app.config import settings
from app.errors import ContentGenerationError

logger = logging.getLogger(__name__)

_SCRIPT_PROMPT = """\
You are a TikTok video script writer specializing in product content.

Product:
- Name: {name}
- Category: {category}
- Price: {price}
- Description: {description}

Style: {style}
Target duration: {duration} seconds

Write a TikTok video script with three sections: hook, body, and CTA (call to action).

Return ONLY valid JSON (no markdown fencing):
{{
  "hook": {{
    "text": "<voiceover text for the hook, grab attention in first 2-3 seconds>",
    "visual": "<visual direction for what should appear on screen>",
    "duration": <seconds as number>
  }},
  "body": {{
    "text": "<voiceover text for the main content, showcase the product>",
    "visual": "<visual direction for product showcase>",
    "duration": <seconds as number>
  }},
  "cta": {{
    "text": "<voiceover text for call to action>",
    "visual": "<visual direction for the CTA>",
    "duration": <seconds as number>
  }}
}}

Guidelines:
- Hook: attention-grabbing question or statement (2-4 seconds)
- Body: product features, benefits, demonstration ({body_duration} seconds)
- CTA: clear call to action — link in bio, TikTok Shop, etc. (2-3 seconds)
- Keep language natural and conversational
- Total duration should be approximately {duration} seconds
"""


def _parse_json_response(text: str) -> dict:
    """Parse Claude's JSON response, handling optional markdown code blocks."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```\w*\n?", "", stripped)
        stripped = re.sub(r"\n?```$", "", stripped)
        stripped = stripped.strip()

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", stripped, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        raise ContentGenerationError(
            "Failed to parse script generation response",
            details={"raw_response": text[:500]},
        )


def _validate_script(script: dict) -> dict:
    """Ensure the script has the required structure with defaults."""
    for section in ("hook", "body", "cta"):
        if section not in script or not isinstance(script[section], dict):
            script[section] = {"text": "", "visual": "", "duration": 3.0}
        else:
            script[section].setdefault("text", "")
            script[section].setdefault("visual", "")
            script[section].setdefault("duration", 3.0)
            # Ensure duration is a number
            try:
                script[section]["duration"] = float(script[section]["duration"])
            except (ValueError, TypeError):
                script[section]["duration"] = 3.0
    return script


async def generate_script(
    product_name: str,
    product_category: str,
    product_price: float | None,
    product_description: str,
    style: str = "product_review",
    duration: int = 30,
) -> dict:
    """Generate a structured video script for a TikTok product video.

    Returns a dict with keys: hook, body, cta — each containing
    text, visual, and duration.

    Raises ContentGenerationError on failure.
    """
    import anthropic

    body_duration = max(5, duration - 7)  # Reserve ~4s hook + ~3s CTA

    prompt = _SCRIPT_PROMPT.format(
        name=product_name,
        category=product_category or "General",
        price=f"${product_price:.2f}" if product_price is not None else "Unknown",
        description=product_description[:1000] if product_description else "No description",
        style=style,
        duration=duration,
        body_duration=body_duration,
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        logger.debug("Script response: %s", response_text[:300])

        script = _parse_json_response(response_text)
        script = _validate_script(script)

        return script

    except anthropic.APIError as exc:
        raise ContentGenerationError(
            f"Anthropic API error during script generation: {exc}",
            details={"api_error": str(exc)},
        ) from exc
    except ContentGenerationError:
        raise
    except Exception as exc:
        raise ContentGenerationError(
            f"Unexpected error during script generation: {exc}",
        ) from exc


def script_to_voiceover_text(script: dict) -> str:
    """Join hook, body, and CTA text into a single voiceover string."""
    parts: list[str] = []
    for section in ("hook", "body", "cta"):
        section_data = script.get(section, {})
        if isinstance(section_data, dict):
            text = section_data.get("text", "")
            if text and text.strip():
                parts.append(text.strip())
    return " ".join(parts)
