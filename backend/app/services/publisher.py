import asyncio
import logging
from pathlib import Path
from playwright.async_api import async_playwright
from app.services.adspower import AdsPowerService
from app.errors import BrowserError, UploadError
from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)


class PublishEngine:
    def __init__(self, adspower: AdsPowerService):
        self.ads = adspower
        self.last_error: str | None = None

    async def execute_task(self, task, video, profile) -> bool:
        """Execute a single publish task. Returns True on success."""
        self.last_error = None
        browser_data = None
        try:
            # Validate video file exists before starting browser
            if not Path(video.file_path).exists():
                raise UploadError(f"Video file not found: {video.file_path}")

            logger.info("Task %d: starting browser for profile %s", task.id, profile.profile_id)
            await ws_manager.broadcast(task.id, "uploading", 10)
            browser_data = await self.ads.start_browser(profile.profile_id)

            # Try puppeteer first (Chromium), fall back to selenium
            ws_url = (
                browser_data.get("ws", {}).get("puppeteer")
                or browser_data.get("ws", {}).get("selenium")
            )
            if not ws_url:
                raise BrowserError(f"No WebSocket URL in AdsPower response: {browser_data}")
            logger.info("Task %d: connecting to CDP at %s", task.id, ws_url)

            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp(ws_url)
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
                # Always open a new tab — existing tabs may have other sites open
                page = await context.new_page()

                await ws_manager.broadcast(task.id, "publishing", 30)
                platform = getattr(profile, "platform", "tiktok") or "tiktok"
                if platform == "tiktok":
                    await self._tiktok_upload(page, task, video)
                else:
                    logger.warning("Task %d: unsupported platform %s, attempting TikTok flow", task.id, platform)
                    await self._tiktok_upload(page, task, video)

                await ws_manager.broadcast(task.id, "published", 100)
                logger.info("Task %d: published successfully", task.id)
                return True

        except Exception as e:
            self.last_error = str(e)
            logger.exception("Task %d failed: %s", task.id, e)
            await ws_manager.broadcast(task.id, "failed", 0, error=str(e))
            return False

        finally:
            if browser_data:
                await self.ads.stop_browser(profile.profile_id)

    async def _find_element(self, page, selectors: list[str], timeout: int = 10000, label: str = "element", state: str = "visible"):
        """Try multiple selectors to find an element. Returns first match or None.
        Use state='attached' for hidden elements like file inputs."""
        for selector in selectors:
            try:
                el = await page.wait_for_selector(selector, timeout=timeout, state=state)
                if el:
                    logger.info("Found %s with selector: %s", label, selector)
                    return el
            except Exception:
                continue
        return None

    async def _dismiss_dialogs(self, page, task_id: int):
        """Aggressively dismiss all TikTok modal overlays.

        TikTok uses TUXModal overlays inside [data-floating-ui-portal] elements
        that intercept pointer events and block button clicks.
        Uses a 3-tier strategy: JS button clicks → DOM disable → Playwright fallback.
        """
        dismissed = 0

        # Strategy 1: Click modal buttons via JS (instant, no Playwright timeouts)
        try:
            js_clicked = await page.evaluate("""
                (() => {
                    let count = 0;
                    const overlays = document.querySelectorAll('.TUXModal-overlay, [class*="TUXModal"]');
                    const targets = ['got it', 'turn on', 'cancel', 'no', 'ok', 'close', 'not now', 'skip', 'dismiss'];
                    for (const overlay of overlays) {
                        for (const btn of overlay.querySelectorAll('button')) {
                            const text = btn.textContent.trim().toLowerCase();
                            if (targets.includes(text)) {
                                btn.click();
                                count++;
                            }
                        }
                    }
                    return count;
                })()
            """)
            dismissed += js_clicked
            if js_clicked > 0:
                logger.info("Task %d: JS-clicked %d modal button(s)", task_id, js_clicked)
                await asyncio.sleep(0.5)
        except Exception:
            pass

        # Strategy 2: Disable only MODAL overlays (not all floating-ui portals — those
        # include hashtag dropdowns, tooltips, etc. that TikTok needs)
        try:
            removed = await page.evaluate("""
                (() => {
                    let count = 0;
                    // Only target actual modal overlays, not all floating-ui portals
                    document.querySelectorAll('.TUXModal-overlay, [class*="TUXModal"]').forEach(el => {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                        count++;
                    });
                    // Only hide floating-ui portals that contain modal overlays
                    document.querySelectorAll('[data-floating-ui-portal]').forEach(portal => {
                        if (portal.querySelector('.TUXModal-overlay, [class*="TUXModal"]')) {
                            portal.style.pointerEvents = 'none';
                            portal.style.display = 'none';
                            count++;
                        }
                    });
                    return count;
                })()
            """)
            if removed:
                logger.info("Task %d: disabled %d modal overlay(s) via DOM", task_id, removed)
                dismissed += removed
        except Exception:
            pass

        # Strategy 3: Playwright fallback for any dialogs that survived JS
        for selector in ['button:text-is("Got it")', 'button:text-is("Turn on")', 'button:text-is("Cancel")']:
            try:
                btn = await page.wait_for_selector(selector, timeout=500)
                if btn and await btn.is_visible():
                    await btn.click(force=True)
                    dismissed += 1
                    logger.info("Task %d: Playwright-dismissed dialog: %s", task_id, selector)
                    await asyncio.sleep(0.3)
            except Exception:
                continue

        return dismissed

    async def _tiktok_upload(self, page, task, video):
        """TikTok Creator Studio upload flow via Playwright."""
        upload_url = "https://www.tiktok.com/creator#/upload?scene=creator_center"
        logger.info("Task %d: navigating to %s", task.id, upload_url)
        await page.goto(upload_url, timeout=30000)
        await page.wait_for_load_state("networkidle", timeout=30000)
        logger.info("Task %d: page loaded, current URL: %s", task.id, page.url)

        # Dismiss any initial popups
        await self._dismiss_dialogs(page, task.id)

        # 1. Find and use file input (hidden, so use state="attached")
        file_input = await self._find_element(
            page,
            ['input[type="file"]', 'input[accept*="video"]', '[data-e2e="upload-input"] input'],
            timeout=15000,
            label="file input",
            state="attached",
        )
        if not file_input:
            logger.error("Task %d: file input not found. URL: %s", task.id, page.url)
            try:
                await page.screenshot(path=f"/tmp/tiktok_debug_{task.id}.png")
            except Exception:
                pass
            raise UploadError("Could not find file input on TikTok upload page")

        logger.info("Task %d: uploading video file: %s", task.id, video.file_path)
        await file_input.set_input_files(video.file_path)

        # 2. Wait for video to finish uploading (progress bar reaches 100%)
        #    TikTok shows upload progress. We need to wait until it's done before proceeding.
        logger.info("Task %d: waiting for video upload to complete...", task.id)

        # First wait for the editor page to appear (caption area signals the edit page loaded)
        editor_ready = await self._find_element(
            page,
            [
                '[contenteditable="true"]',
                '.notranslate[contenteditable]',
                '.DraftEditor-root',
                '[class*="caption"] [contenteditable]',
                'div[data-e2e="caption-textarea"]',
                'div[data-contents]',
            ],
            timeout=60000,
            label="caption editor",
        )
        if not editor_ready:
            logger.warning("Task %d: editor not detected, waiting 30s fallback", task.id)
            await page.wait_for_timeout(30000)

        # Now wait for the upload progress to complete (poll until no progress indicator)
        # TikTok shows a progress bar or percentage during upload. Wait for it to finish.
        for i in range(60):  # Max 120 seconds (60 * 2s)
            try:
                # Check if upload is still in progress
                progress_text = await page.evaluate("""
                    (() => {
                        // Look for any progress indicator text
                        const body = document.body.innerText;
                        // Check for percentage like "53.22%"
                        const match = body.match(/(\\d+\\.?\\d*)%/);
                        if (match) {
                            const pct = parseFloat(match[1]);
                            // If we see a percentage and it's not 100%, upload is still going
                            if (pct < 100 && pct > 0) return `uploading:${pct}`;
                        }
                        // Check for "Uploading" text
                        if (body.includes('Uploading') || body.includes('seconds left')) return 'uploading:0';
                        return 'done';
                    })()
                """)
                if progress_text == 'done':
                    logger.info("Task %d: upload complete (iteration %d)", task.id, i)
                    break
                logger.info("Task %d: upload progress: %s", task.id, progress_text)
                await ws_manager.broadcast(task.id, "uploading", min(10 + i, 50))
            except Exception:
                pass
            await asyncio.sleep(2)

        # Dismiss any post-upload dialogs (content checks, tips, etc.)
        await self._dismiss_dialogs(page, task.id)
        await asyncio.sleep(1)
        await self._dismiss_dialogs(page, task.id)

        await ws_manager.broadcast(task.id, "publishing", 60)

        # 3. Fill caption + tags (combined, like reference project)
        full_text = ""
        if task.content:
            full_text = task.content
        if task.tags:
            full_text = f"{full_text} {task.tags}".strip()

        if full_text:
            caption_area = await self._find_element(
                page,
                [
                    '[contenteditable="true"]',
                    '.notranslate[contenteditable]',
                    '.DraftEditor-root',
                    'div[data-contents]',
                    '[data-e2e="caption-textarea"]',
                    '[data-e2e="caption-input"]',
                    '[class*="caption"] [contenteditable]',
                ],
                timeout=10000,
                label="caption area",
            )
            if caption_area:
                await caption_area.click()
                await asyncio.sleep(0.3)
                # Select all existing text and replace
                await page.keyboard.press("Meta+a")  # macOS
                await asyncio.sleep(0.2)
                await page.keyboard.press("Backspace")
                await asyncio.sleep(0.3)
                await page.keyboard.type(full_text, delay=20)
                logger.info("Task %d: filled caption+tags (%d chars)", task.id, len(full_text))
                # Close any hashtag/mention dropdown that TikTok opens after typing
                await asyncio.sleep(0.5)
                await page.keyboard.press("Escape")
                await asyncio.sleep(0.3)
                # Click outside the caption area to deselect and close dropdowns
                await page.click("body", position={"x": 10, "y": 10})
                await asyncio.sleep(0.3)
            else:
                logger.warning("Task %d: caption area not found, skipping text input", task.id)

        await ws_manager.broadcast(task.id, "publishing", 80)

        # 4. Handle scheduling if scheduled_at is set
        if task.scheduled_at:
            await self._set_tiktok_schedule(page, task)

        await ws_manager.broadcast(task.id, "publishing", 85)

        # 5. Wait for TikTok content checks to complete before posting
        logger.info("Task %d: waiting for content checks to complete...", task.id)
        for i in range(15):  # Max 30 seconds
            try:
                checks_status = await page.evaluate("""
                    (() => {
                        const body = document.body.innerText;
                        if (body.includes('No issues found')) return 'done';
                        if (body.includes('Checks can only start')) return 'done';
                        if (body.includes('Checking') || body.includes('Running checks')) return 'checking';
                        return 'unknown';
                    })()
                """)
                if checks_status == 'done':
                    logger.info("Task %d: content checks passed (iteration %d)", task.id, i)
                    break
                if checks_status == 'checking':
                    logger.info("Task %d: content checks still running...", task.id)
            except Exception:
                pass
            await asyncio.sleep(2)

        await ws_manager.broadcast(task.id, "publishing", 90)

        # 6. Dismiss any dialogs before clicking Post
        await self._dismiss_dialogs(page, task.id)
        await asyncio.sleep(0.5)

        # 7. Scroll to bottom where the Post button lives
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1)

        # 8. Find the Post button (shorter timeouts — if it's there, it's there)
        post_btn = await self._find_element(
            page,
            [
                'button:text-is("Post")',
                '[data-e2e="post-button"]',
                'button:text-is("Schedule")',
                'button:text-is("发布")',
            ],
            timeout=3000,
            label="post button",
        )

        # Fallback: find Post button via JavaScript (more reliable than CSS selectors)
        if not post_btn:
            logger.info("Task %d: Playwright selectors failed, trying JS to find Post button", task.id)
            try:
                found_via_js = await page.evaluate("""
                    (() => {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const text = btn.textContent.trim();
                            if (text === 'Post' || text === 'Schedule' || text === '发布') {
                                // Highlight it so we can find it via a unique attribute
                                btn.setAttribute('data-aigc-post-btn', 'true');
                                return true;
                            }
                        }
                        return false;
                    })()
                """)
                if found_via_js:
                    post_btn = await page.wait_for_selector('[data-aigc-post-btn="true"]', timeout=2000)
                    logger.info("Task %d: found Post button via JS fallback", task.id)
            except Exception as js_err:
                logger.warning("Task %d: JS Post button search failed: %s", task.id, js_err)

        if not post_btn:
            try:
                await page.screenshot(path=f"/tmp/tiktok_post_debug_{task.id}.png", full_page=True)
                logger.error("Task %d: post button not found, debug screenshot saved", task.id)
            except Exception:
                pass
            raise UploadError("Could not find Post button on TikTok page")

        # 9. Click Post with overlay-aware retry loop
        await post_btn.scroll_into_view_if_needed()
        await asyncio.sleep(0.5)

        max_retries = 3
        for attempt in range(max_retries):
            await self._dismiss_dialogs(page, task.id)
            await asyncio.sleep(0.3)
            try:
                await post_btn.click(timeout=5000)
                logger.info("Task %d: post button clicked (attempt %d)", task.id, attempt + 1)
                break
            except Exception as click_err:
                logger.warning("Task %d: click attempt %d failed: %s", task.id, attempt + 1, click_err)
                if attempt == max_retries - 1:
                    # Final attempt: force click bypasses all actionability checks
                    await post_btn.click(force=True)
                    logger.info("Task %d: post button force-clicked", task.id)

        # 8. Wait and verify the post was submitted
        pre_url = page.url
        await page.wait_for_timeout(8000)
        post_url = page.url
        if pre_url != post_url:
            logger.info("Task %d: page navigated after post: %s -> %s", task.id, pre_url, post_url)
        else:
            logger.warning("Task %d: page URL unchanged after clicking Post — video may not have been submitted", task.id)

    async def _set_tiktok_schedule(self, page, task):
        """Toggle schedule mode and set the publish time on TikTok."""
        try:
            schedule_toggle = await self._find_element(
                page,
                ['[data-e2e="schedule-toggle"]', 'label:has-text("Schedule")'],
                timeout=5000,
                label="schedule toggle",
            )
            if schedule_toggle:
                await schedule_toggle.click()
                await asyncio.sleep(1)

                time_input = await self._find_element(
                    page,
                    ['[data-e2e="schedule-time-input"]', 'input[type="datetime-local"]'],
                    timeout=5000,
                    label="schedule time input",
                )
                if time_input:
                    await time_input.fill(str(task.scheduled_at))
                    logger.info("Task %d: schedule time set to %s", task.id, task.scheduled_at)
        except Exception as e:
            logger.warning("Task %d: failed to set schedule, posting immediately: %s", task.id, e)

    async def execute_batch(self, tasks_with_relations: list) -> dict:
        """Execute multiple tasks sequentially."""
        results = {"success": 0, "failed": 0, "errors": []}
        for task, video, profile in tasks_with_relations:
            ok = await self.execute_task(task, video, profile)
            if ok:
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({"task_id": task.id, "error": task.error_message})
            await asyncio.sleep(2)
        return results
