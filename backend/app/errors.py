"""Structured error classes for the AIGC platform."""


class AdsPowerError(Exception):
    """Error from AdsPower API."""

    def __init__(self, message: str, code: int | None = None):
        self.code = code
        super().__init__(message)


class PublishError(Exception):
    """Error during video publishing."""


class BrowserError(PublishError):
    """Error connecting to or controlling the browser."""


class UploadError(PublishError):
    """Error uploading video to the platform."""


# ── Upstream pipeline errors ──


class ScrapingError(Exception):
    """Error scraping product data."""

    def __init__(self, message: str, details: dict | None = None):
        self.details = details or {}
        super().__init__(message)


class ContentGenerationError(Exception):
    """Error generating AI content."""

    def __init__(self, message: str, details: dict | None = None):
        self.details = details or {}
        super().__init__(message)


class VideoError(Exception):
    """Error during video creation or processing."""


class KieVideoError(VideoError):
    """Error from kie.ai video generation API."""


class PipelineError(Exception):
    """Error in pipeline orchestration."""


class PipelineStageError(PipelineError):
    """Error in a specific pipeline stage."""

    def __init__(self, stage: str, cause: Exception | None = None):
        self.stage = stage
        self.cause = cause
        super().__init__(f"Pipeline stage '{stage}' failed: {cause}")
