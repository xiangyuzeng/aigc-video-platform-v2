"""Pipeline state management.

Defines stage sequences for different video sources and provides
utilities for tracking pipeline progress via JSON-serialized state.
"""

import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Stage sequences for each video source type
KIE_STAGES: list[str] = [
    "content_generation",
    "script_generation",
    "ai_video_generation",
    "subtitle_generation",
    "video_finalization",
    "publish",
]

MOVIEPY_STAGES: list[str] = [
    "content_generation",
    "script_generation",
    "image_generation",
    "tts_generation",
    "video_assembly",
    "subtitle_generation",
    "video_finalization",
    "publish",
]

UPLOAD_STAGES: list[str] = [
    "content_generation",
    "subtitle_generation",
    "video_finalization",
    "publish",
]


def get_stages_for_source(video_source: str) -> list[str]:
    """Return the ordered stage list for a given video source.

    Args:
        video_source: One of "kie", "moviepy", or "upload".

    Returns:
        List of stage name strings.
    """
    source_map = {
        "kie": KIE_STAGES,
        "moviepy": MOVIEPY_STAGES,
        "upload": UPLOAD_STAGES,
    }
    return list(source_map.get(video_source, KIE_STAGES))


def init_stages_json(stages: list[str]) -> str:
    """Create the initial stages JSON string with all stages set to pending.

    Args:
        stages: List of stage name strings.

    Returns:
        JSON string representing the stage array.
    """
    stage_list = [
        {
            "stage": stage,
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "error": None,
            "output_data": None,
        }
        for stage in stages
    ]
    return json.dumps(stage_list)


def update_stage_status(
    stages_json: str,
    stage: str,
    status: str,
    error: str | None = None,
    output_data: dict | None = None,
) -> str:
    """Update a specific stage's status in the stages JSON.

    Args:
        stages_json: Current JSON string of stages.
        stage: Name of the stage to update.
        status: New status ("pending", "running", "completed", "failed").
        error: Error message if status is "failed".
        output_data: Output data dict if status is "completed".

    Returns:
        Updated JSON string.
    """
    stages = json.loads(stages_json) if stages_json else []
    now = datetime.utcnow().isoformat()

    for s in stages:
        if s["stage"] == stage:
            s["status"] = status
            if status == "running":
                s["started_at"] = now
            elif status == "completed":
                s["completed_at"] = now
                s["output_data"] = output_data
            elif status == "failed":
                s["completed_at"] = now
                s["error"] = error
            break

    return json.dumps(stages)


def get_stage_output(stages_json: str, stage: str) -> dict:
    """Get the output_data for a completed stage.

    Args:
        stages_json: Current JSON string of stages.
        stage: Name of the stage.

    Returns:
        The output_data dict, or empty dict if not found/completed.
    """
    stages = json.loads(stages_json) if stages_json else []

    for s in stages:
        if s["stage"] == stage and s.get("output_data"):
            return s["output_data"]

    return {}


def get_current_stage(stages_json: str) -> str | None:
    """Get the name of the first non-completed stage.

    Args:
        stages_json: Current JSON string of stages.

    Returns:
        Stage name, or None if all stages are completed.
    """
    stages = json.loads(stages_json) if stages_json else []

    for s in stages:
        if s["status"] != "completed":
            return s["stage"]

    return None
