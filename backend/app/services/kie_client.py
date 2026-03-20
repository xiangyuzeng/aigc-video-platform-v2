"""kie.ai Veo video generation API client.

Provides an async client for submitting video generation tasks,
polling for completion, and downloading results via the kie.ai API.
"""

import asyncio
import logging
from pathlib import Path

import httpx

from app.errors import KieVideoError

logger = logging.getLogger(__name__)


class KieClient:
    """Async client for the kie.ai video generation API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.kie.ai/api/v1",
    ):
        if not api_key:
            raise KieVideoError(
                "KIE_API_KEY is not configured. Set it in your .env file to use AI video generation."
            )
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def generate_video(
        self,
        prompt: str,
        provider: str = "veo",
        model: str = "veo3_fast",
        aspect_ratio: str = "9:16",
        **kwargs,
    ) -> str:
        """Submit a video generation task.

        Returns the task ID for polling.
        Raises KieVideoError on failure.
        """
        payload = {
            "prompt": prompt,
            "model": model,
            "aspect_ratio": aspect_ratio,
            **kwargs,
        }

        try:
            resp = await self._client.post(f"/{provider}/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise KieVideoError(
                f"kie.ai API returned HTTP {exc.response.status_code}: "
                f"{exc.response.text[:300]}"
            ) from exc
        except httpx.HTTPError as exc:
            raise KieVideoError(f"Network error contacting kie.ai: {exc}") from exc

        if data.get("code") != 200:
            raise KieVideoError(
                f"kie.ai generate error: {data.get('msg', 'Unknown')} (code={data.get('code')})"
            )

        task_id = (data.get("data") or {}).get("taskId", "")
        if not task_id:
            raise KieVideoError(f"No task ID in kie.ai response: {data}")

        logger.info("kie.ai video generation submitted, taskId=%s", task_id)
        return str(task_id)

    async def poll_task(
        self,
        task_id: str,
        provider: str = "veo",
        timeout: float = 300.0,
        poll_interval: float = 10.0,
    ) -> list[str]:
        """Poll a video generation task until completion.

        Returns a list of video URLs on success.
        Raises KieVideoError on timeout or failure.
        """
        elapsed = 0.0

        while elapsed < timeout:
            try:
                resp = await self._client.get(
                    f"/{provider}/record-info",
                    params={"taskId": task_id},
                )
                resp.raise_for_status()
                result = resp.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 404:
                    raise KieVideoError(
                        f"kie.ai poll returned HTTP {exc.response.status_code}"
                    ) from exc
                # 404 can happen briefly, retry
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval
                continue
            except httpx.HTTPError as exc:
                logger.warning("Poll network error (will retry): %s", exc)
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval
                continue

            task_data = result.get("data") or {}
            flag = task_data.get("successFlag")

            logger.debug(
                "kie.ai task %s flag=%s (%.0fs elapsed)",
                task_id,
                flag,
                elapsed,
            )

            if flag == 1:
                # Success — parse resultUrls
                response_data = task_data.get("response") or task_data
                raw_urls = response_data.get("resultUrls", [])
                if isinstance(raw_urls, str):
                    import json as _json
                    urls = _json.loads(raw_urls)
                elif isinstance(raw_urls, list):
                    urls = raw_urls
                else:
                    urls = []
                if not urls:
                    raise KieVideoError(
                        f"Task {task_id} completed but no video URLs found"
                    )
                logger.info("kie.ai task %s completed with %d videos", task_id, len(urls))
                return urls

            if flag in (2, 3):
                raise KieVideoError(
                    f"kie.ai task {task_id} failed (flag={flag})"
                )

            # flag == 0 or None → still processing
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        raise KieVideoError(
            f"kie.ai task {task_id} timed out after {timeout}s"
        )

    async def download_video(
        self,
        video_url: str,
        output_path: str | Path,
    ) -> str:
        """Download a video from a URL to a local path.

        Returns the local file path as a string.
        Raises KieVideoError on failure.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=120.0,
            ) as dl_client:
                resp = await dl_client.get(video_url)
                resp.raise_for_status()
                output_path.write_bytes(resp.content)
        except httpx.HTTPError as exc:
            raise KieVideoError(
                f"Failed to download video from {video_url}: {exc}"
            ) from exc

        file_size = output_path.stat().st_size
        logger.info(
            "Downloaded kie.ai video -> %s (%.1f MB)",
            output_path,
            file_size / 1_048_576,
        )
        return str(output_path)

    async def generate_and_download(
        self,
        prompt: str,
        output_path: str | Path,
        provider: str = "veo",
        model: str = "veo3_fast",
        aspect_ratio: str = "9:16",
        poll_timeout: float = 300.0,
        poll_interval: float = 10.0,
        **kwargs,
    ) -> str:
        """Full flow: submit -> poll -> download first video.

        Returns the local file path of the downloaded video.
        Raises KieVideoError on failure.
        """
        task_id = await self.generate_video(
            prompt=prompt,
            provider=provider,
            model=model,
            aspect_ratio=aspect_ratio,
            **kwargs,
        )

        video_urls = await self.poll_task(
            task_id=task_id,
            provider=provider,
            timeout=poll_timeout,
            poll_interval=poll_interval,
        )

        return await self.download_video(video_urls[0], output_path)
