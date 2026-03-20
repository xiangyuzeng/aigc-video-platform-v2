import asyncio
import logging

logger = logging.getLogger(__name__)

try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("faster-whisper not installed, transcription disabled")


async def transcribe_video(video_path: str, model_size: str = "base") -> str:
    """
    Transcribe a video file using faster-whisper.
    Runs the CPU-bound whisper inference in a thread pool.
    Returns the full transcript text.
    """
    if not WHISPER_AVAILABLE:
        raise RuntimeError("faster-whisper is not installed")

    def _run() -> str:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(video_path, beam_size=5)
        return " ".join(segment.text.strip() for segment in segments)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run)
