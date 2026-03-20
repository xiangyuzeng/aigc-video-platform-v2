"""HTTP-based TikTok product scraper (no browser needed).

Scrapes product data from TikTok Shop product URLs via HTTP requests,
extracting structured information from embedded JSON, OG tags, or page title.
"""

import json
import logging
import random
import re
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.errors import ScrapingError

logger = logging.getLogger(__name__)

_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

_BLOCK_KEYWORDS = [
    "security check",
    "captcha",
    "verify you are human",
    "access denied",
    "please verify",
    "are you a robot",
    "challenge-platform",
]


def _random_headers() -> dict[str, str]:
    """Return request headers with a random User-Agent."""
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }


def _check_for_block(html: str) -> None:
    """Raise ScrapingError if the page appears to be a bot/CAPTCHA block."""
    lower = html[:5000].lower()
    for keyword in _BLOCK_KEYWORDS:
        if keyword in lower:
            raise ScrapingError(
                f"Bot/CAPTCHA block detected (keyword: '{keyword}')",
                details={"keyword": keyword},
            )


def _extract_rehydration_json(html: str) -> dict | None:
    """Try to extract product data from __UNIVERSAL_DATA_FOR_REHYDRATION__ script."""
    pattern = r'<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>'
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return None

    try:
        data = json.loads(match.group(1))
    except (json.JSONDecodeError, TypeError):
        return None

    # Navigate the nested structure to find product info
    default_scope = data.get("__DEFAULT_SCOPE__", {})

    # Try product detail path
    product_detail = (
        default_scope.get("webapp.product-detail", {})
        or default_scope.get("webapp.product_detail", {})
    )
    if product_detail:
        product_info = product_detail.get("productInfo", product_detail.get("product", {}))
        if product_info:
            return _normalize_product_info(product_info, data)

    # Try walking all keys for anything product-like
    for key, value in default_scope.items():
        if isinstance(value, dict):
            for sub_key in ("productInfo", "product", "itemInfo"):
                if sub_key in value and isinstance(value[sub_key], dict):
                    return _normalize_product_info(value[sub_key], data)

    return None


def _normalize_product_info(info: dict, raw_data: dict) -> dict:
    """Normalize a product info dict from the rehydration JSON."""
    # Extract images
    images = []
    for img in info.get("images", info.get("imageList", [])):
        if isinstance(img, str):
            images.append(img)
        elif isinstance(img, dict):
            images.append(img.get("url", img.get("urlList", [""])[0] if img.get("urlList") else ""))

    # Price extraction
    price = None
    price_info = info.get("price", info.get("priceInfo", {}))
    if isinstance(price_info, dict):
        price_str = price_info.get("price", price_info.get("originalPrice", ""))
        if price_str:
            try:
                price = float(re.sub(r"[^\d.]", "", str(price_str)))
            except (ValueError, TypeError):
                pass
    elif isinstance(price_info, (int, float)):
        price = float(price_info)

    return {
        "name": info.get("title", info.get("name", "")),
        "category": info.get("category", info.get("categoryName", "")),
        "price": price,
        "description": info.get("description", info.get("desc", "")),
        "image_urls": [u for u in images if u],
        "raw_data": raw_data,
    }


def _extract_og_tags(html: str) -> dict | None:
    """Extract product data from Open Graph meta tags."""
    og_data: dict[str, str] = {}
    for match in re.finditer(
        r'<meta\s+(?:property|name)=["\']og:(\w+)["\']\s+content=["\']([^"\']*)["\']',
        html,
        re.IGNORECASE,
    ):
        og_data[match.group(1)] = match.group(2)

    if not og_data.get("title"):
        return None

    # Extract price from description or dedicated tags
    price = None
    price_str = og_data.get("price:amount", "")
    if price_str:
        try:
            price = float(re.sub(r"[^\d.]", "", price_str))
        except (ValueError, TypeError):
            pass

    images = [og_data["image"]] if og_data.get("image") else []

    return {
        "name": og_data.get("title", ""),
        "category": "",
        "price": price,
        "description": og_data.get("description", ""),
        "image_urls": images,
        "raw_data": og_data,
    }


def _extract_page_title(html: str) -> dict | None:
    """Fallback: extract product name from page title and try to find price in page."""
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    if not match:
        return None

    title = match.group(1).strip()
    # Clean common suffixes
    for suffix in (" | TikTok", " - TikTok", " | TikTok Shop"):
        if title.endswith(suffix):
            title = title[: -len(suffix)].strip()

    if not title:
        return None

    # Try to extract price from anywhere in the page
    price = None
    price_match = re.search(r'\$(\d+(?:\.\d{1,2})?)', html[:10000])
    if price_match:
        try:
            price = float(price_match.group(1))
        except ValueError:
            pass

    # Try to extract description from meta tag
    description = ""
    desc_match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']',
        html,
        re.IGNORECASE,
    )
    if desc_match:
        description = desc_match.group(1)

    # Try to find images
    images = []
    og_img = re.search(
        r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if og_img:
        images.append(og_img.group(1))

    return {
        "name": title,
        "category": "",
        "price": price,
        "description": description[:500],
        "image_urls": images,
        "raw_data": {"source": "page_title"},
    }


async def scrape_tiktok_product(url: str) -> dict:
    """Scrape product data from a TikTok product URL.

    Returns a dict with keys: name, category, price, description,
    image_urls (list), source_url, raw_data (dict).

    Raises ScrapingError on failure.
    """
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30.0,
        headers=_random_headers(),
    ) as client:
        # Resolve short URLs (vm.tiktok.com)
        parsed = urlparse(url)
        if parsed.hostname and "vm.tiktok.com" in parsed.hostname:
            logger.info("Resolving short URL: %s", url)
            try:
                resp = await client.head(url, follow_redirects=True)
                url = str(resp.url)
                logger.info("Resolved to: %s", url)
            except httpx.HTTPError as exc:
                raise ScrapingError(f"Failed to resolve short URL: {exc}") from exc

        # Fetch the page
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ScrapingError(
                f"HTTP {exc.response.status_code} fetching {url}",
                details={"status_code": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            raise ScrapingError(f"Network error fetching {url}: {exc}") from exc

        html = resp.text
        _check_for_block(html)

        # Strategy 1: Rehydration JSON
        result = _extract_rehydration_json(html)
        if result and result.get("name"):
            logger.info("Extracted product via rehydration JSON: %s", result["name"][:80])
            result["source_url"] = url
            return result

        # Strategy 2: OG tags
        result = _extract_og_tags(html)
        if result and result.get("name"):
            logger.info("Extracted product via OG tags: %s", result["name"][:80])
            result["source_url"] = url
            return result

        # Strategy 3: Page title fallback
        result = _extract_page_title(html)
        if result and result.get("name"):
            logger.info("Extracted product via page title: %s", result["name"][:80])
            result["source_url"] = url
            return result

        raise ScrapingError(
            "Could not extract product data from page",
            details={"url": url},
        )


async def download_product_images(
    image_urls: list[str],
    product_id: int,
    output_dir: str,
) -> list[str]:
    """Download product images to local disk.

    Returns a list of local file paths for successfully downloaded images.
    """
    from pathlib import Path

    out = Path(output_dir) / str(product_id)
    out.mkdir(parents=True, exist_ok=True)

    downloaded: list[str] = []
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30.0,
        headers=_random_headers(),
    ) as client:
        for i, url in enumerate(image_urls):
            try:
                resp = await client.get(url)
                resp.raise_for_status()

                # Determine extension from content-type
                ct = resp.headers.get("content-type", "")
                ext = ".jpg"
                if "png" in ct:
                    ext = ".png"
                elif "webp" in ct:
                    ext = ".webp"

                dest = out / f"product_{i}{ext}"
                dest.write_bytes(resp.content)
                downloaded.append(str(dest))
                logger.info("Downloaded image %d/%d -> %s", i + 1, len(image_urls), dest)
            except httpx.HTTPError as exc:
                logger.warning("Failed to download image %s: %s", url, exc)
                continue

    return downloaded
