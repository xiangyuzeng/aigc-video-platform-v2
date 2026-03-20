import asyncio
import logging
import re

from playwright.async_api import async_playwright

from app.services.adspower import AdsPowerService
from app.errors import BrowserError

logger = logging.getLogger(__name__)


class TikTokScraper:
    """Scrape video captions and hashtags directly from TikTok video pages."""

    def __init__(self, ads: AdsPowerService, scraper_profile_id: str):
        self.ads = ads
        self.scraper_profile_id = scraper_profile_id

    async def scrape_video(self, url: str) -> dict:
        """
        Launch an AdsPower browser profile, navigate to a TikTok video URL,
        extract the description (caption + hashtags), and return parsed results.
        """
        browser_data = await self.ads.start_browser(self.scraper_profile_id)
        logger.info("AdsPower start_browser response: %s", browser_data)

        ws_url = (
            browser_data.get("ws", {}).get("puppeteer")
            or browser_data.get("ws", {}).get("selenium")
        )
        if not ws_url:
            raise BrowserError(f"No WebSocket URL in AdsPower response: {browser_data}")

        logger.info("Connecting to CDP at: %s", ws_url)
        await asyncio.sleep(1)

        result: dict = {
            "content": "",
            "tags": "",
            "trans_content": "",
            "trans_tags": "",
        }

        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp(ws_url)
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
                page = await context.new_page()

                logger.info("Navigating to TikTok URL: %s", url)
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await asyncio.sleep(2)  # Let TikTok's JS render

                # Extract description text using multiple selector strategies
                description = ""

                # Strategy 1: TikTok's data-e2e selectors
                desc_selectors = [
                    '[data-e2e="browse-video-desc"]',
                    '[data-e2e="video-desc"]',
                    'h1[data-e2e="browse-video-desc"]',
                    'span[data-e2e="browse-video-desc"]',
                ]
                for selector in desc_selectors:
                    try:
                        el = await page.wait_for_selector(selector, timeout=5000)
                        if el:
                            description = await el.inner_text()
                            if description.strip():
                                logger.info("Found description via selector: %s", selector)
                                break
                    except Exception:
                        continue

                # Strategy 2: JS extraction from page meta or DOM
                if not description.strip():
                    try:
                        description = await page.evaluate("""
                            (() => {
                                // Try meta description
                                const meta = document.querySelector('meta[name="description"]');
                                if (meta && meta.content) return meta.content;

                                // Try finding video description container
                                const descEl = document.querySelector(
                                    '[class*="DivVideoInfoContainer"] [class*="SpanText"]'
                                ) || document.querySelector(
                                    '[class*="video-meta-title"]'
                                ) || document.querySelector(
                                    '[class*="tiktok-"][data-e2e*="desc"]'
                                );
                                if (descEl) return descEl.innerText;

                                return '';
                            })()
                        """)
                        if description.strip():
                            logger.info("Found description via JS fallback")
                    except Exception:
                        pass

                # Strategy 3: Scrape all visible hashtag links
                hashtag_texts: list[str] = []
                try:
                    hashtags = await page.query_selector_all('a[href*="/tag/"], [data-e2e="search-common-link"]')
                    for tag_el in hashtags:
                        text = await tag_el.inner_text()
                        text = text.strip()
                        if text and (text.startswith("#") or text.startswith("＃")):
                            hashtag_texts.append(text)
                    if hashtag_texts:
                        logger.info("Found %d hashtag links", len(hashtag_texts))
                except Exception:
                    pass

                logger.info("Raw description: %s", description[:200] if description else "(empty)")

                if description.strip() or hashtag_texts:
                    # Combine description + any extra hashtags found via links
                    full_text = description.strip()
                    if hashtag_texts:
                        extra_tags = " ".join(t for t in hashtag_texts if t not in full_text)
                        if extra_tags:
                            full_text = f"{full_text} {extra_tags}"

                    result = self.parse_content_tags(full_text)

                # Take debug screenshot if nothing found
                if not result["content"] and not result["tags"]:
                    try:
                        await page.screenshot(path=f"/tmp/tiktok_scrape_debug.png", full_page=True)
                        logger.warning("No content found, debug screenshot saved to /tmp/tiktok_scrape_debug.png")
                        logger.info("Page URL: %s", page.url)
                        # Log what we can see
                        page_text = await page.evaluate("document.body.innerText.substring(0, 500)")
                        logger.info("Page text preview: %s", page_text)
                    except Exception:
                        pass

        finally:
            await self.ads.stop_browser(self.scraper_profile_id)

        return result

    @staticmethod
    def parse_content_tags(raw_text: str) -> dict:
        """
        Parse TikTok description text into content and tags.

        TikTok descriptions typically look like:
        "Some caption text #hashtag1 #hashtag2 #hashtag3"

        Returns dict with content, tags, trans_content, trans_tags.
        """
        raw_text = raw_text.replace("＃", "#")

        # Split at the first hashtag to separate caption from tags
        if "#" in raw_text:
            idx = raw_text.index("#")
            content_part = raw_text[:idx].strip()
            tags_part = raw_text[idx:]
        else:
            content_part = raw_text.strip()
            tags_part = ""

        # Format tags: normalize and deduplicate
        formatted_tags = ""
        if tags_part:
            normalised = re.sub(r"[，,\n\t]+", " ", tags_part)
            tokens: list[str] = []
            for part in normalised.split():
                sub_parts = re.split(r"(?<!^)(?=#)", part)
                for sp in sub_parts:
                    sp = sp.strip()
                    if not sp:
                        continue
                    if not sp.startswith("#"):
                        sp = "#" + sp
                    tokens.append(sp)

            seen: set[str] = set()
            unique: list[str] = []
            for token in tokens:
                key = token.lower()
                if key not in seen and token != "#":
                    seen.add(key)
                    unique.append(token)

            formatted_tags = " ".join(unique)

        # Detect Chinese content for bilingual split
        chinese_re = re.compile(r"[\u4e00-\u9fff]")
        has_chinese = bool(chinese_re.search(content_part))

        return {
            "content": content_part if has_chinese else "",
            "tags": formatted_tags if has_chinese else "",
            "trans_content": content_part if not has_chinese else "",
            "trans_tags": formatted_tags if not has_chinese else "",
        }


# Keep backward compat alias
FastMossScraper = TikTokScraper
