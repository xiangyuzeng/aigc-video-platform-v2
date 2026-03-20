"""Claude-based content generation for TikTok product marketing.

Generates captions, hashtags, descriptions, and translations using
Anthropic's Claude API.
"""

import json
import logging
import re

from app.config import settings
from app.errors import ContentGenerationError

logger = logging.getLogger(__name__)

STYLES: dict[str, str] = {
    "product_review": "Honest product review — share genuine first impressions, pros and cons, and a verdict.",
    "unboxing": "Exciting unboxing experience — build anticipation, reveal the product, and react authentically.",
    "lifestyle": "Lifestyle integration — show how the product fits naturally into everyday life.",
    "comparison": "Product comparison — highlight what makes this product stand out versus alternatives.",
    "tutorial": "How-to tutorial — demonstrate the product's features and teach viewers something useful.",
    "problem_solution": "Problem-solution format — present a relatable problem, then reveal the product as the solution.",
}

_CONTENT_PROMPT = """\
You are a TikTok content creator specializing in viral product marketing.

Product:
- Name: {name}
- Category: {category}
- Price: {price}
- Description: {description}

Style: {style_name} — {style_description}

{angles_section}

Generate engaging TikTok content for this product.

Return ONLY valid JSON (no markdown fencing):
{{
  "caption": "<engaging TikTok caption, 1-3 sentences, include emojis>",
  "hashtags": ["<hashtag1>", "<hashtag2>", ...],
  "description": "<longer description for the TikTok post, 2-4 sentences>"
}}

Guidelines:
- Caption should hook viewers immediately
- Include {max_hashtags} relevant hashtags (trending + niche)
- Description should expand on the caption
- Keep the tone authentic and engaging, not overly salesy
"""

_TRANSLATE_PROMPT = """\
Translate the following TikTok product marketing content to {language}.
Keep the same tone, energy, and marketing style. Adapt hashtags to be relevant \
in the target language (keep some English hashtags if they're universally used).

Content to translate:
- Caption: {caption}
- Hashtags: {hashtags}
- Description: {description}

Return ONLY valid JSON (no markdown fencing):
{{
  "caption": "<translated caption>",
  "hashtags": ["<translated_hashtag1>", "<translated_hashtag2>", ...],
  "description": "<translated description>"
}}
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
            "Failed to parse content generation response",
            details={"raw_response": text[:500]},
        )


async def generate_content(
    product_name: str,
    product_category: str,
    product_price: float | None,
    product_description: str,
    style: str = "product_review",
    suggested_angles: list[str] | None = None,
) -> dict:
    """Generate TikTok marketing content for a product.

    Returns a dict with keys: caption, hashtags (list), description.

    Raises ContentGenerationError on failure.
    """
    import anthropic

    style_name = style
    style_description = STYLES.get(style, STYLES["product_review"])

    angles_section = ""
    if suggested_angles:
        angles_section = "Suggested content angles to consider:\n" + "\n".join(
            f"- {a}" for a in suggested_angles
        )

    prompt = _CONTENT_PROMPT.format(
        name=product_name,
        category=product_category or "General",
        price=f"${product_price:.2f}" if product_price is not None else "Unknown",
        description=product_description[:1000] if product_description else "No description",
        style_name=style_name,
        style_description=style_description,
        angles_section=angles_section,
        max_hashtags=settings.content_max_hashtags,
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        logger.debug("Content response: %s", response_text[:300])

        result = _parse_json_response(response_text)

        # Ensure hashtags start with #
        hashtags = result.get("hashtags", [])
        hashtags = [
            t if t.startswith("#") else f"#{t}" for t in hashtags
        ]

        return {
            "caption": result.get("caption", ""),
            "hashtags": hashtags[: settings.content_max_hashtags],
            "description": result.get("description", ""),
        }

    except anthropic.APIError as exc:
        raise ContentGenerationError(
            f"Anthropic API error during content generation: {exc}",
            details={"api_error": str(exc)},
        ) from exc
    except ContentGenerationError:
        raise
    except Exception as exc:
        raise ContentGenerationError(
            f"Unexpected error during content generation: {exc}",
        ) from exc


async def translate_content(
    caption: str,
    hashtags: list[str],
    description: str,
    target_language: str,
) -> dict:
    """Translate marketing content to a target language.

    Returns a dict with keys: caption, hashtags (list), description.

    Raises ContentGenerationError on failure.
    """
    import anthropic

    prompt = _TRANSLATE_PROMPT.format(
        language=target_language,
        caption=caption,
        hashtags=", ".join(hashtags),
        description=description,
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        logger.debug("Translation response: %s", response_text[:300])

        result = _parse_json_response(response_text)

        hashtags_out = result.get("hashtags", [])
        hashtags_out = [
            t if t.startswith("#") else f"#{t}" for t in hashtags_out
        ]

        return {
            "caption": result.get("caption", ""),
            "hashtags": hashtags_out,
            "description": result.get("description", ""),
        }

    except anthropic.APIError as exc:
        raise ContentGenerationError(
            f"Anthropic API error during translation: {exc}",
            details={"api_error": str(exc)},
        ) from exc
    except ContentGenerationError:
        raise
    except Exception as exc:
        raise ContentGenerationError(
            f"Unexpected error during translation: {exc}",
        ) from exc
