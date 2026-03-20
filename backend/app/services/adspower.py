"""AdsPower anti-detect browser API client.

Based on production patterns from AIGCAutomation reference project.
Adds structured errors, retry-safe request method, and proper cleanup.
"""

import logging
import httpx
from app.errors import AdsPowerError

logger = logging.getLogger(__name__)


class AdsPowerService:
    """Async client for the AdsPower local API."""

    def __init__(self, base_url: str = "http://localhost:50325", timeout: float = 15.0):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    async def close(self) -> None:
        await self.client.aclose()

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make an API request and validate the response."""
        url = path if path.startswith("http") else path
        resp = await self.client.request(method, url, **kwargs)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise AdsPowerError(data.get("msg", "Unknown AdsPower error"), data.get("code"))
        return data.get("data", {})

    # ── Connection Test ──

    async def test_connection(self) -> tuple[bool, str]:
        """Ping the server by fetching groups. Returns (ok, message)."""
        try:
            data = await self._request("GET", "/api/v1/group/list")
            groups = data.get("list", [])
            return True, f"Connected. {len(groups)} groups found."
        except Exception as e:
            return False, str(e)

    # ── Groups ──

    async def fetch_groups(self) -> list[dict]:
        """GET /api/v1/group/list → list of {group_id, group_name}"""
        data = await self._request("GET", "/api/v1/group/list")
        return data.get("list", [])

    # ── Profiles ──

    async def fetch_profiles(self, group_id: str | None = None, page_size: int = 1000) -> list[dict]:
        """POST /api/v2/browser-profile/list → list of profile dicts"""
        payload: dict = {"limit": page_size}
        if group_id:
            payload["group_id"] = group_id
        data = await self._request("POST", "/api/v2/browser-profile/list", json=payload)
        return data.get("list", [])

    # ── Browser Control ──

    async def start_browser(self, profile_id: str) -> dict:
        """Start a browser profile and return connection data.

        Returns dict with 'ws' key containing WebSocket URLs and 'webdriver' path.
        """
        logger.info("Starting browser for profile %s", profile_id)
        data = await self._request(
            "GET",
            "/api/v1/browser/start",
            params={"user_id": profile_id, "open_tabs": 1},
        )
        logger.info("Browser started for %s: ws keys=%s", profile_id, list(data.get("ws", {}).keys()))
        return data

    async def stop_browser(self, profile_id: str) -> bool:
        """Stop a running browser profile."""
        try:
            await self._request("GET", "/api/v1/browser/stop", params={"user_id": profile_id})
            logger.info("Browser stopped for profile %s", profile_id)
            return True
        except Exception as e:
            logger.warning("Failed to stop browser for %s: %s", profile_id, e)
            return False
