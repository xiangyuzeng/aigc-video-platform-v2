"""Claude-based viral potential scoring for TikTok products.

Uses Anthropic's Claude API to evaluate a product's potential for
creating viral TikTok content, returning a 0-100 score with reasoning.
"""

import json
import logging
import re

from app.config import settings
from app.errors import ContentGenerationError

logger = logging.getLogger(__name__)

_SCORING_PROMPT = """\
You are a TikTok Shop product analyst. Score this product on its viral potential \
for TikTok video content.

Product:
- Name: {name}
- Category: {category}
- Price: {price}
- Description: {description}

Score from 0-100 based on these criteria:
1. Visual appeal — How visually interesting is this product for video?
2. TikTok trending potential — Does it fit current TikTok trends?
3. Price point appeal — Is the price attractive for impulse buying?
4. Problem-solving value — Does it solve a relatable everyday problem?
5. Uniqueness — Is it novel or surprising enough to grab attention?

Return ONLY valid JSON (no markdown fencing):
{{"score": <0-100>, "reasoning": "<1-2 sentences>", "suggested_angles": ["<angle1>", "<angle2>", "<angle3>"]}}
"""


def _parse_score_response(text: str) -> dict:
    """Parse Claude's JSON response, handling optional markdown code blocks."""
    # Strip markdown code fences if present
    stripped = text.strip()
    if stripped.startswith("```"):
        # Remove opening fence (with optional language tag)
        stripped = re.sub(r"^```\w*\n?", "", stripped)
        stripped = re.sub(r"\n?```$", "", stripped)
        stripped = stripped.strip()

    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as exc:
        # Try to find JSON object in the text
        match = re.search(r"\{.*\}", stripped, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                raise ContentGenerationError(
                    f"Failed to parse scoring response as JSON: {exc}",
                    details={"raw_response": text[:500]},
                ) from exc
        else:
            raise ContentGenerationError(
                f"No JSON found in scoring response: {exc}",
                details={"raw_response": text[:500]},
            ) from exc

    # Validate required fields
    score = data.get("score")
    if score is None:
        raise ContentGenerationError(
            "Scoring response missing 'score' field",
            details={"parsed": data},
        )

    return {
        "score": max(0.0, min(100.0, float(score))),
        "reasoning": data.get("reasoning", ""),
        "suggested_angles": data.get("suggested_angles", []),
    }


async def score_product(
    name: str,
    category: str,
    price: float | None,
    description: str,
) -> tuple[float, str, list[str]]:
    """Score a product's viral potential for TikTok content.

    Returns:
        (score, reasoning, suggested_angles) where score is 0-100.

    Raises ContentGenerationError on failure.
    """
    import anthropic

    prompt = _SCORING_PROMPT.format(
        name=name,
        category=category or "Unknown",
        price=f"${price:.2f}" if price is not None else "Unknown",
        description=description[:1000] if description else "No description",
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        logger.debug("Score response: %s", response_text[:300])

        parsed = _parse_score_response(response_text)
        return (
            parsed["score"],
            parsed["reasoning"],
            parsed["suggested_angles"],
        )

    except anthropic.APIError as exc:
        raise ContentGenerationError(
            f"Anthropic API error during scoring: {exc}",
            details={"api_error": str(exc)},
        ) from exc
    except ContentGenerationError:
        raise
    except Exception as exc:
        raise ContentGenerationError(
            f"Unexpected error during scoring: {exc}",
        ) from exc
